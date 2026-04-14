/**
 * Background handler: Process import jobs from PubSub.
 * Multi-store: reads products once from Storage, runs Bulk Operations per store sequentially.
 * Each store uses up to 5 concurrent bulk ops (API 2026-04).
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {StoreRepository} from '../../repositories/storeRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';
import {runConcurrentBulkImport} from '../../services/shopify-bulk-import-service.js';
import {readAndMergeCsvFiles} from '../../helpers/storage-csv-reader.js';

const importHistoryRepo = new ImportHistoryRepository();
const storeRepo = new StoreRepository();

/**
 * Entry point from PubSub trigger.
 */
export async function processProductImport(messageData) {
  console.log('[import] PubSub message received:', JSON.stringify(messageData?.message?.json || {}).slice(0, 500));
  const data = messageData.message.json;
  const {importJobs, batchId, fileNames} = data;

  // Load products from Storage CSV or Firestore subcollection (legacy)
  let products;
  if (batchId && fileNames?.length) {
    const result = await readAndMergeCsvFiles(batchId, fileNames);
    products = result.mergedProducts;
    if (result.errors?.length) {
      console.warn(`[import] ${result.errors.length} file(s) failed to parse`);
    }
  } else if (data.importId) {
    products = await importHistoryRepo.getImportProducts(data.importId);
  }

  if (!products?.length) {
    const jobs = importJobs || [{importId: data.importId}];
    for (const job of jobs) {
      await importHistoryRepo.markFailed(job.importId, 'No products found. CSV files may have expired — please re-upload.');
    }
    return;
  }

  const jobs = importJobs || [{
    importId: data.importId, storeId: data.storeId, storeName: data.storeName
  }];

  console.log(`[import] ${products.length} products → ${jobs.length} store(s)`);

  // Process each store sequentially (Bulk Ops only allows 1 set of ops per store at a time)
  for (const job of jobs) {
    await processStoreImport(job, products);
  }
}

/** Import products to a single store via Bulk Operations (up to 5 concurrent). */
async function processStoreImport(job, products) {
  const {importId, storeId, storeName} = job;

  const store = await storeRepo.getById(storeId);
  if (!store?.accessToken) {
    await importHistoryRepo.markFailed(importId,
      `Missing access token for ${storeName}. Please reinstall the app.`);
    return;
  }

  const shopifyService = new ShopifyService({
    shopDomain: store.shopDomain, accessToken: store.accessToken
  });

  try {
    await shopifyService.verifyCredentials();
  } catch (err) {
    await importHistoryRepo.markFailed(importId,
      `Cannot connect to ${storeName}: ${err.message}`);
    return;
  }

  const total = products.length;
  console.log(`[import:${importId}] Starting: ${total} products → ${storeName}`);

  await importHistoryRepo.updateProgress(importId, {
    status: 'processing',
    statusMessage: `Importing ${total} products to ${storeName}...`
  });

  try {
    const result = await runConcurrentBulkImport(shopifyService.shopify, products, {
      importId,
      maxConcurrent: 5,
      onChunkProgress: ({chunkIndex, status, objectCount, totalInChunk}) => {
        importHistoryRepo.updateProgress(importId, {
          status: 'processing',
          processedProducts: objectCount,
          statusMessage: `Chunk ${chunkIndex + 1}: ${status} (${objectCount}/${totalInChunk})`
        }).catch(() => {});
      }
    });

    const {successCount, failedCount, errors} = result;

    if (failedCount >= total) {
      await importHistoryRepo.markFailed(importId, `All products failed to import to ${storeName}`, {
        failedProductDetails: errors
      });
    } else {
      await importHistoryRepo.markCompleted(importId, {
        successCount, failedCount, processedProducts: total,
        failedProductDetails: errors
      });
    }

    console.log(`[import:${importId}] ${storeName}: ${successCount} success, ${failedCount} failed`);
  } catch (error) {
    console.error(`[import:${importId}] ${storeName} error:`, error);
    await importHistoryRepo.markFailed(importId, `${storeName}: ${error.message}`);
  }
}
