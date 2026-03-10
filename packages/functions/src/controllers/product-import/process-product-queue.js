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
  try {
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

    // Check max retry attempts
    if (attempts >= MAX_ATTEMPTS) {
      console.log(`Queue item ${queueId} exceeded max attempts (${attempts}), marking as failed`);
      await productQueueRepo.markFailed(queueId, `Exceeded max retry attempts (${MAX_ATTEMPTS})`);
      return;
    }

    // Mark as processing
    await productQueueRepo.updateStatus(queueId, 'processing');

    console.log(
      `Processing product ${productIndex +
        1}/${totalProducts} for import ${importId} (attempt ${attempts + 1})`
    );

    // Create Shopify service
    const shopifyService = new ShopifyService({
      shopDomain,
      accessToken
    });

    // Always upsert: create if new, merge variants if exists
    try {
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
      await handleFailedImport(queueId, importId, totalProducts, product, error);
    }
  } catch (error) {
    console.error('Error processing queue item:', error);
    // Continue to next item
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
    variantCount
  });

  // Mark queue item as completed
  await productQueueRepo.updateStatus(queueId, 'completed');

  // Update import progress (success)
  const importJob = await importHistoryRepo.getById(importId);
  await importHistoryRepo.updateProgress(importId, {
    processedProducts: (importJob.processedProducts || 0) + 1,
    processedVariants: (importJob.processedVariants || 0) + variantCount,
    successCount: (importJob.successCount || 0) + 1,
    status: 'processing'
  });

  // Check if this is the last product
  if ((importJob.processedProducts || 0) + 1 >= totalProducts) {
    await importHistoryRepo.markCompleted(importId, {
      successCount: (importJob.successCount || 0) + 1,
      failedCount: importJob.failedCount || 0
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

    // Update import progress (failure)
    const variantCount = product.variants ? product.variants.length : 1;
    const importJob = await importHistoryRepo.getById(importId);
    await importHistoryRepo.updateProgress(importId, {
      processedProducts: (importJob.processedProducts || 0) + 1,
      processedVariants: (importJob.processedVariants || 0) + variantCount,
      failedCount: (importJob.failedCount || 0) + 1
    });

    // Check if this is the last product
    if ((importJob.processedProducts || 0) + 1 >= totalProducts) {
      if ((importJob.failedCount || 0) + 1 >= totalProducts) {
        // All products failed
        await importHistoryRepo.markFailed(importId, 'All products failed to import');
      } else {
        // Some products succeeded
        await importHistoryRepo.markCompleted(importId, {
          successCount: importJob.successCount || 0,
          failedCount: (importJob.failedCount || 0) + 1
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
