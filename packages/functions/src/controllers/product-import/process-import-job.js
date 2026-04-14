/**
 * Background handler: Process entire import job from PubSub
 * Uses Shopify Bulk Operations API with up to 5 concurrent ops (API 2026-04).
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {StoreRepository} from '../../repositories/storeRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';
import {runConcurrentBulkImport} from '../../services/shopify-bulk-import-service.js';

const importHistoryRepo = new ImportHistoryRepository();
const storeRepo = new StoreRepository();

/**
 * Process product import from PubSub message via Bulk Operations API.
 * Splits products into up to 5 chunks and runs them concurrently.
 */
export async function processProductImport(messageData) {
  const data = messageData.message.json;
  const {importId, storeId, storeName, shopDomain} = data;

  // Read accessToken from Firestore (never sent via PubSub for security)
  const store = await storeRepo.getById(storeId);
  const accessToken = store?.accessToken;

  if (!accessToken) {
    await importHistoryRepo.markFailed(importId,
      `Missing access token for ${storeName} (${shopDomain}). Please reinstall the app.`);
    return;
  }

  const acquired = await importHistoryRepo.acquireLock(importId, 'pubsub');
  if (!acquired) {
    console.log(`Import ${importId} already locked, skipping`);
    return;
  }

  const shopifyService = new ShopifyService({shopDomain, accessToken});

  try {
    // Verify credentials before starting
    try {
      await shopifyService.verifyCredentials();
    } catch (err) {
      await importHistoryRepo.markFailed(importId,
        `Cannot connect to ${storeName}: ${err.message}. Please reinstall the app.`);
      return;
    }

    // Read products from Firestore
    const products = await importHistoryRepo.getImportProducts(importId);
    if (!products?.length) {
      await importHistoryRepo.markFailed(importId, 'No products found in import job');
      return;
    }

    const total = products.length;
    console.log(`[import:${importId}] Starting concurrent bulk import: ${total} products → ${storeName}`);
    await updateStatus(importId, 'processing', `Importing ${total} products (up to 5 concurrent ops)...`);

    // Run concurrent bulk operations (up to 5 chunks)
    const result = await runConcurrentBulkImport(shopifyService.shopify, products, {
      importId,
      maxConcurrent: 5,
      onChunkProgress: ({chunkIndex, status, objectCount, totalInChunk}) => {
        importHistoryRepo.updateProgress(importId, {
          status: 'processing',
          statusMessage: `Chunk ${chunkIndex + 1}: ${status} (${objectCount}/${totalInChunk} objects)`
        }).catch(() => {});
      }
    });

    // Mark final status
    const {successCount, failedCount, errors} = result;

    if (failedCount >= total) {
      await importHistoryRepo.markFailed(importId, 'All products failed to import', {
        failedProductDetails: errors
      });
    } else {
      await importHistoryRepo.markCompleted(importId, {
        successCount,
        failedCount,
        processedProducts: total,
        failedProductDetails: errors
      });
    }

    console.log(`[import:${importId}] Done: ${successCount} success, ${failedCount} failed`);
  } catch (error) {
    console.error(`[import:${importId}] Error:`, error);
    await importHistoryRepo.markFailed(importId, error.message || 'Unexpected error');
  } finally {
    await importHistoryRepo.releaseLock(importId);
  }
}

/** Helper: update progress with status message */
async function updateStatus(importId, status, statusMessage) {
  await importHistoryRepo.updateProgress(importId, {status, statusMessage});
}
