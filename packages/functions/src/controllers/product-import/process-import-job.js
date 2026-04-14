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

  // Update totalProducts now that we've parsed (controller skips parsing for speed)
  const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 1), 0);
  await Promise.all(jobs.map(job =>
    importHistoryRepo.updateProgress(job.importId, {totalProducts: products.length, totalVariants})
  ));

  // Process each store sequentially (Bulk Ops only allows 1 set of ops per store at a time)
  for (const job of jobs) {
    await processStoreImport(job, products);
  }
}

/** Import products to a single store via Bulk Operations (up to 5 concurrent). */
/** Publish imported products to all sales channels via publishablePublishToCurrentChannel. */
async function publishProducts(shopify, products, publicationIds, importId) {
  try {
    console.log(`[import:${importId}] Publishing ${products.length} products to ${publicationIds.length} channels...`);
    // Use productSet's handle to find product IDs, then publish
    // Simpler: just set status to ACTIVE (productSet already does this)
    // The real publish is via publishablePublish mutation per product per channel
    for (let i = 0; i < products.length; i += 50) {
      const batch = products.slice(i, i + 50);
      await Promise.all(batch.map(async (product) => {
        if (!product.handle) return;
        try {
          // Get product ID by handle
          const result = await shopify.graphql(`{
            productByHandle(handle: "${product.handle}") { id }
          }`);
          const productId = result.productByHandle?.id;
          if (!productId) return;

          // Publish to all channels
          await Promise.all(publicationIds.map(pubId =>
            shopify.graphql(`mutation {
              publishablePublish(id: "${productId}", input: [{publicationId: "${pubId}"}]) {
                userErrors { field message }
              }
            }`).catch(() => {})
          ));
        } catch {
          // Skip publish errors — product was imported successfully
        }
      }));
    }
    console.log(`[import:${importId}] Publishing complete`);
  } catch (err) {
    console.warn(`[import:${importId}] Publishing failed (non-blocking):`, err.message);
  }
}

/** Fetch all publication (sales channel) IDs for the store. */
async function fetchPublicationIds(shopify) {
  try {
    const result = await shopify.graphql(`{
      publications(first: 50) {
        nodes { id }
      }
    }`);
    return (result.publications?.nodes || []).map(n => n.id);
  } catch (err) {
    console.warn('[import] Failed to fetch publications:', err.message);
    return [];
  }
}

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

  // Fetch all sales channel IDs for auto-publish after import
  const publicationIds = await fetchPublicationIds(shopifyService.shopify);
  console.log(`[import:${importId}] Will publish to ${publicationIds.length} sales channels after import`);

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

    const {successCount, failedCount, errors, isVariantThrottled} = result;

    if (isVariantThrottled) {
      const msg = `Daily variant limit reached for ${storeName}. ${successCount} imported, ${failedCount} remaining. Retry after midnight UTC.`;
      console.warn(`[import:${importId}] ${msg}`);
      await importHistoryRepo.markFailed(importId, msg, {
        failedProductDetails: errors,
        variantThrottled: true
      });
    } else if (failedCount >= total) {
      await importHistoryRepo.markFailed(importId, `All products failed to import to ${storeName}`, {
        failedProductDetails: errors
      });
    } else {
      // Auto-publish to all sales channels (productSet doesn't support publications inline)
      if (publicationIds.length > 0 && successCount > 0) {
        await publishProducts(shopifyService.shopify, products, publicationIds, importId);
      }
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
