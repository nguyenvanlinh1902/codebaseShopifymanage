/**
 * CronJob handler: Process pending products from queue in batches
 * This runs every minute to process queued products
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {ProductRepository} from '../../repositories/productRepository.js';
import {ProductQueueRepository} from '../../repositories/productQueueRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';

const importHistoryRepo = new ImportHistoryRepository();
const productRepo = new ProductRepository();
const productQueueRepo = new ProductQueueRepository();

const MAX_ATTEMPTS = 3;

/**
 * Process product queue - main entry point
 */
export async function processProductQueue() {
  try {
    console.log('Starting product queue processing...');

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

    // Import product to Shopify
    let result;
    let action = 'created';

    try {
      // Check if product with SKU already exists
      if (product.sku) {
        const existing = await shopifyService.getProductBySku(product.sku);
        if (existing) {
          await handleSkippedProduct(queueId, importId, totalProducts, product, storeName);
          return;
        }
      }

      // Product does not exist - Create new product
      result = await shopifyService.createProduct(product);
      action = 'created';

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
 * Handle skipped product (already exists)
 */
async function handleSkippedProduct(queueId, importId, totalProducts, product, storeName) {
  console.log(`Product with SKU ${product.sku} already exists in store ${storeName}, skipping...`);

  // Mark queue item as completed (skipped)
  await productQueueRepo.updateStatus(queueId, 'completed');

  // Update import progress (skipped counts as success but not imported)
  const importJob = await importHistoryRepo.getById(importId);
  await importHistoryRepo.updateProgress(importId, {
    processedProducts: (importJob.processedProducts || 0) + 1,
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

  console.log(`Skipped product: ${product.title} (already exists)`);
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
  // Save product to Firestore with ALL fields from CSV
  await productRepo.save({
    // Tracking fields
    importId,
    storeId,
    userId,
    storeName,
    shopDomain,
    shopifyProductId: result.product?.id || result.id,
    action,
    importedAt: new Date().toISOString(),

    // All product fields from mapToShopifyProduct()
    // Includes: handle, title, description, options, variants, inventory,
    // images, Google Shopping metadata, SEO fields, pricing, shipping, tax, etc.
    ...product
  });

  // Mark queue item as completed
  await productQueueRepo.updateStatus(queueId, 'completed');

  // Update import progress (success)
  const importJob = await importHistoryRepo.getById(importId);
  await importHistoryRepo.updateProgress(importId, {
    processedProducts: (importJob.processedProducts || 0) + 1,
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
    const importJob = await importHistoryRepo.getById(importId);
    await importHistoryRepo.updateProgress(importId, {
      processedProducts: (importJob.processedProducts || 0) + 1,
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
