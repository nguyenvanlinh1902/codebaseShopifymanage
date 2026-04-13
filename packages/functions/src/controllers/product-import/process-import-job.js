/**
 * Background handler: Process entire import job from PubSub
 * Uses Shopify Bulk Operations API for fast async processing (no rate limits).
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';
import {
  buildProductJsonl,
  createStagedUpload,
  uploadToStagedTarget,
  runBulkMutation,
  pollBulkOperation,
  downloadBulkResults
} from '../../services/shopify-bulk-import-service.js';

const importHistoryRepo = new ImportHistoryRepository();

/**
 * Process product import from PubSub message via Bulk Operations API.
 */
export async function processProductImport(messageData) {
  const data = messageData.message.json;
  const {importId, storeName, shopDomain, accessToken} = data;

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
    console.log(`[import:${importId}] Starting bulk import: ${total} products → ${storeName}`);

    // Step 1: Build JSONL
    await updateStatus(importId, 'preparing', `Building JSONL for ${total} products...`);
    const jsonl = buildProductJsonl(products);
    const fileSize = Buffer.byteLength(jsonl, 'utf8');

    // Step 2: Staged upload
    await updateStatus(importId, 'uploading', `Uploading ${(fileSize / 1024).toFixed(0)}KB to Shopify...`);
    const target = await createStagedUpload(shopifyService.shopify, {
      filename: `import-${importId}.jsonl`,
      fileSize
    });

    // Step 3: Upload JSONL file
    await uploadToStagedTarget(target, jsonl);
    const uploadPath = target.parameters.find(p => p.name === 'key')?.value || target.resourceUrl;
    console.log(`[import:${importId}] JSONL uploaded (${fileSize} bytes)`);

    // Step 4: Start bulk mutation
    await updateStatus(importId, 'processing', 'Shopify is processing products...');
    const operation = await runBulkMutation(shopifyService.shopify, uploadPath);
    console.log(`[import:${importId}] Bulk operation started: ${operation.id}`);

    // Step 5: Poll with progress updates
    const result = await pollBulkOperation(shopifyService.shopify, operation.id, {
      maxWait: 1800000, // 30 minutes
      onProgress: ({status, objectCount}) => {
        // Fire-and-forget progress updates (don't await to avoid slowing poll)
        importHistoryRepo.updateProgress(importId, {
          status: 'processing',
          statusMessage: `Processing... ${objectCount} objects handled`,
          processedProducts: Math.min(objectCount, total)
        }).catch(() => {});
      }
    });

    // Step 6: Handle result
    if (result.status !== 'COMPLETED') {
      const errMsg = `Bulk operation ${result.status}${result.errorCode ? `: ${result.errorCode}` : ''}`;
      await importHistoryRepo.markFailed(importId, errMsg);
      return;
    }

    // Parse results JSONL
    let successCount = total;
    let failedCount = 0;
    let failedDetails = [];

    if (result.url) {
      const parsed = await downloadBulkResults(result.url);
      successCount = parsed.successCount;
      failedCount = parsed.failedCount;
      failedDetails = parsed.errors.slice(0, 100);
    }

    // Mark final status
    if (failedCount >= total) {
      await importHistoryRepo.markFailed(importId, 'All products failed to import', {
        failedProductDetails: failedDetails
      });
    } else {
      await importHistoryRepo.markCompleted(importId, {
        successCount,
        failedCount,
        processedProducts: total,
        failedProductDetails: failedDetails
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
