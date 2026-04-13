/**
 * CronJob handler: Process pending products from queue in batches
 * This runs every minute to process queued products.
 * Also rescues stuck imports where PubSub failed to trigger.
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {ProductRepository} from '../../repositories/productRepository.js';
import {ProductQueueRepository} from '../../repositories/productQueueRepository.js';
import {StoreRepository} from '../../repositories/storeRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';
import {isTokenExpired} from './retry-helpers.js';

const importHistoryRepo = new ImportHistoryRepository();
const productRepo = new ProductRepository();
const productQueueRepo = new ProductQueueRepository();
const storeRepo = new StoreRepository();

const MAX_ATTEMPTS = 3;

/**
 * Process product queue - main entry point
 */
export async function processProductQueue() {
  try {
    console.log('Starting product queue processing...');

    // Rescue stuck imports where PubSub failed (0 progress after 2 min)
    await rescueStuckImports();

    // Get queue statistics
    const stats = await productQueueRepo.getQueueStats();
    console.log('Queue stats:', stats);

    // Reset stuck items (items that have been processing for too long)
    const resetCount = await productQueueRepo.resetStuckItems(30); // 30 minutes timeout
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} stuck items back to pending`);
    }

    // Get pending products (batch of 100)
    const pendingProducts = await productQueueRepo.getPendingBatch(100);

    if (pendingProducts.length === 0) {
      console.log('No pending products in queue');
      return;
    }

    console.log(`Processing ${pendingProducts.length} pending products`);

    // Process each product
    for (const queueItem of pendingProducts) {
      await processQueueItem(queueItem);
    }

    console.log('Product queue processing completed');
  } catch (error) {
    console.error('Process product queue error:', error);
    throw error;
  }
}

/**
 * Rescue stuck imports: detect imports with 0 progress after 2+ minutes
 * and enqueue their products into the queue for cron processing.
 * This handles the case where PubSub fails to trigger.
 */
async function rescueStuckImports() {
  try {
    const stuckImports = await importHistoryRepo.getStuckImports(2, 5);

    if (stuckImports.length === 0) return;

    console.log(`Found ${stuckImports.length} stuck import(s), rescuing...`);

    for (const importJob of stuckImports) {
      try {
        // Get store for accessToken
        const store = await storeRepo.getById(importJob.storeId);
        if (!store || !store.accessToken) {
          console.error(`Stuck import ${importJob.id}: store ${importJob.storeId} missing or no token`);
          await importHistoryRepo.markFailed(importJob.id, 'Store not found or missing access token');
          continue;
        }

        // Check if products are already enqueued for this import
        const existingQueue = await productQueueRepo.getByImportId(importJob.id);
        if (existingQueue.length > 0) {
          console.log(`Stuck import ${importJob.id}: already has ${existingQueue.length} queue items, skipping enqueue`);
          continue;
        }

        // Read products from subcollection
        const products = await importHistoryRepo.getImportProducts(importJob.id);
        if (!products || products.length === 0) {
          await importHistoryRepo.markFailed(importJob.id, 'No products found in import job');
          continue;
        }

        // Enqueue each product
        for (let i = 0; i < products.length; i++) {
          await productQueueRepo.enqueue({
            importId: importJob.id,
            storeId: importJob.storeId,
            userId: importJob.userId,
            storeName: importJob.storeName,
            shopDomain: importJob.shopDomain,
            accessToken: store.accessToken,
            product: products[i],
            productIndex: i,
            totalProducts: products.length
          });
        }

        // Update status to processing
        await importHistoryRepo.updateProgress(importJob.id, {status: 'processing'});
        console.log(`Rescued import ${importJob.id}: enqueued ${products.length} products`);
      } catch (err) {
        console.error(`Failed to rescue import ${importJob.id}:`, err);
      }
    }
  } catch (error) {
    // Don't let rescue failures block normal queue processing
    console.error('Rescue stuck imports error:', error);
  }
}

/**
 * Process a single queue item
 */
async function processQueueItem(queueItem) {
  const {
    id: queueId,
    importId,
    storeId,
    userId,
    storeName,
    shopDomain,
    accessToken,
    product,
    productIndex,
    totalProducts,
    attempts
  } = queueItem;

  try {
    // Check max retry attempts
    if (attempts >= MAX_ATTEMPTS) {
      console.log(`Queue item ${queueId} exceeded max attempts (${attempts}), marking as failed`);
      await productQueueRepo.markFailed(queueId, `Exceeded max retry attempts (${MAX_ATTEMPTS})`);
      return;
    }

    // Acquire cron lock — skip if PubSub processor is currently active on this import
    const acquired = await importHistoryRepo.acquireLock(importId, 'cron');
    if (!acquired) {
      console.log(`Import ${importId} locked by PubSub processor, skipping queue item ${queueId}`);
      return;
    }

    try {
      // Mark as processing
      await productQueueRepo.updateStatus(queueId, 'processing');

      console.log(
        `Processing product ${productIndex + 1}/${totalProducts} for import ${importId} (attempt ${attempts + 1})`
      );

      // Create Shopify service
      const shopifyService = new ShopifyService({shopDomain, accessToken});

      // Always upsert: create if new, merge variants if exists
      const {result, action} = await shopifyService.upsertProduct(product);

      await handleSuccessfulImport(
        queueId,
        importId,
        storeId,
        userId,
        storeName,
        shopDomain,
        totalProducts,
        product,
        result,
        action
      );
    } catch (error) {
      // Detect token expiration — stop the entire import
      if (isTokenExpired(error)) {
        console.error(`Import ${importId}: access token expired or invalid`);
        await importHistoryRepo.updateProgress(importId, {
          status: 'auth_failed',
          error: 'Store access token expired. Please reconnect the store.'
        });
        await productQueueRepo.updateStatus(queueId, 'failed', 'Auth token expired');
        return; // Stop processing this queue item
      }

      await handleFailedImport(queueId, importId, totalProducts, product, error);
    } finally {
      await importHistoryRepo.releaseLock(importId);
    }
  } catch (error) {
    // Fix 1: Outer catch must update queue item status — never leave items stuck in "processing"
    console.error('Error processing queue item:', error);
    try {
      await productQueueRepo.updateStatus(queueId, 'failed', error.message);
      await importHistoryRepo.atomicIncrement(importId, {
        processedProducts: 1,
        failedCount: 1
      });
    } catch (statusError) {
      console.error('Failed to update queue item status after outer error:', statusError);
    }
  }
}

/**
 * Handle successful product import
 */
async function handleSuccessfulImport(
  queueId,
  importId,
  storeId,
  userId,
  storeName,
  shopDomain,
  totalProducts,
  product,
  result,
  action
) {
  const variantCount = product.variants ? product.variants.length : 1;

  // Fix 7: Track actual variant count from GraphQL response instead of assuming all succeeded
  const actualVariants = result.product?.variants?.length || variantCount;

  // Save product tracking data to Firestore (lightweight, no heavy variant/image arrays)
  await productRepo.save({
    importId,
    storeId,
    userId,
    storeName,
    shopDomain,
    shopifyProductId: result.product?.id || result.id,
    action,
    importedAt: new Date().toISOString(),
    title: product.title,
    handle: product.handle,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    sku: product.variants?.[0]?.sku || product.sku || '',
    price: product.variants?.[0]?.price || product.price || '0.00',
    variantCount: actualVariants
  });

  // Mark queue item as completed
  await productQueueRepo.updateStatus(queueId, 'completed');

  // Fix 4: Atomic increment — avoid stale read-then-update race condition
  await importHistoryRepo.atomicIncrement(importId, {
    processedProducts: 1,
    processedVariants: actualVariants,
    successCount: 1
  });

  // Completion check: read AFTER atomic increment to get accurate totals
  const updated = await importHistoryRepo.getById(importId);
  if ((updated.processedProducts || 0) >= totalProducts) {
    await importHistoryRepo.markCompleted(importId, {
      successCount: updated.successCount || 0,
      failedCount: updated.failedCount || 0
    });
  }

  console.log(`Successfully ${action} product: ${product.title}`);
}

/**
 * Handle failed product import
 */
async function handleFailedImport(queueId, importId, totalProducts, product, error) {
  console.error(`Failed to import product ${product.title}:`, error);

  // Increment attempts
  const newAttempts = await productQueueRepo.incrementAttempts(queueId);

  // Check if we should retry
  if (newAttempts >= MAX_ATTEMPTS) {
    // Mark as failed after max attempts
    await productQueueRepo.markFailed(queueId, error.message);

    // Fix 4: Atomic increment for failure counters
    const variantCount = product.variants ? product.variants.length : 1;
    await importHistoryRepo.atomicIncrement(importId, {
      processedProducts: 1,
      processedVariants: variantCount,
      failedCount: 1
    });

    // Completion check: read AFTER atomic increment
    const updated = await importHistoryRepo.getById(importId);
    if ((updated.processedProducts || 0) >= totalProducts) {
      if ((updated.failedCount || 0) >= totalProducts) {
        // All products failed
        await importHistoryRepo.markFailed(importId, 'All products failed to import');
      } else {
        // Some products succeeded
        await importHistoryRepo.markCompleted(importId, {
          successCount: updated.successCount || 0,
          failedCount: updated.failedCount || 0
        });
      }
    }
  } else {
    // Reset to pending for retry
    await productQueueRepo.updateStatus(queueId, 'pending', error.message);
    console.log(
      `Product ${product.title} will be retried (attempt ${newAttempts}/${MAX_ATTEMPTS})`
    );
  }
}
