/**
 * Background handler: Process entire import job from PubSub
 * Processes all products SEQUENTIALLY with rate limiting to avoid 429
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {ProductRepository} from '../../repositories/productRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';
import {callWithRetry, sleep, RATE_LIMIT_DELAY} from './retry-helpers.js';

const importHistoryRepo = new ImportHistoryRepository();
const productRepo = new ProductRepository();

/**
 * Process product import from PubSub message
 */
export async function processProductImport(messageData) {
  const data = messageData.message.json;
  const {
    importId,
    storeId,
    userId,
    storeName,
    shopDomain,
    accessToken,
    products,
    totalProducts
  } = data;

  // Validate accessToken before starting
  if (!accessToken || !accessToken.startsWith('shpat_')) {
    const errMsg = `Invalid access token for ${storeName} (${shopDomain}). Please reinstall the app.`;
    console.error(`Import ${importId} aborted: ${errMsg}`);
    await importHistoryRepo.markFailed(importId, errMsg);
    return;
  }

  const shopifyService = new ShopifyService({shopDomain, accessToken});

  // Verify credentials with a test API call before processing products
  try {
    await shopifyService.verifyCredentials();
  } catch (verifyError) {
    const errMsg = `Cannot connect to ${storeName} (${shopDomain}): ${verifyError.message || 'Invalid credentials'}. Please reinstall the app.`;
    console.error(`Import ${importId} aborted: ${errMsg}`);
    await importHistoryRepo.markFailed(importId, errMsg);
    return;
  }

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const failedProductDetails = [];

  console.log(`Starting import ${importId}: ${totalProducts} products for ${storeName}`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    try {
      // Update per-product status
      await importHistoryRepo.updateProductStatus(importId, i, 'processing');

      // Check duplicate by SKU
      if (product.sku) {
        const existing = await callWithRetry(() => shopifyService.getProductBySku(product.sku));
        if (existing) {
          skippedCount++;
          await importHistoryRepo.updateProductStatus(importId, i, 'skipped', 'SKU exists');
          await importHistoryRepo.updateProgress(importId, {
            processedProducts: i + 1,
            successCount,
            failedCount,
            skippedCount
          });
          console.log(`[${i + 1}/${totalProducts}] Skipped: ${product.title} (SKU exists)`);
          await sleep(RATE_LIMIT_DELAY);
          continue;
        }
      }

      // Check duplicate by handle
      if (product.handle) {
        const existingByHandle = await callWithRetry(() =>
          shopifyService.getProductByHandle(product.handle)
        );
        if (existingByHandle) {
          failedCount++;
          const errMsg = `Duplicate handle: ${product.handle}`;
          failedProductDetails.push({title: product.title || 'Unknown', error: errMsg});
          await importHistoryRepo.updateProductStatus(importId, i, 'failed', errMsg);
          await importHistoryRepo.updateProgress(importId, {
            processedProducts: i + 1,
            successCount,
            failedCount,
            skippedCount,
            failedProductDetails: failedProductDetails.slice(0, 100)
          });
          console.log(`[${i + 1}/${totalProducts}] Failed: ${product.title} (${errMsg})`);
          await sleep(RATE_LIMIT_DELAY);
          continue;
        }
      }

      // Create product in Shopify (with 429 retry)
      const result = await callWithRetry(() => shopifyService.createProduct(product));

      // Save to Firestore
      await productRepo.save({
        importId,
        storeId,
        userId,
        storeName,
        shopDomain,
        shopifyProductId: result.product?.id || result.id,
        action: 'created',
        importedAt: new Date().toISOString(),
        ...product
      });

      successCount++;
      await importHistoryRepo.updateProductStatus(importId, i, 'completed');
      await importHistoryRepo.updateProgress(importId, {
        processedProducts: i + 1,
        successCount,
        failedCount,
        skippedCount
      });

      console.log(`[${i + 1}/${totalProducts}] Created: ${product.title}`);
    } catch (error) {
      failedCount++;
      const errMsg = error.message || 'Unknown error';
      failedProductDetails.push({title: product.title || 'Unknown', error: errMsg});

      await importHistoryRepo.updateProductStatus(importId, i, 'failed', errMsg);
      await importHistoryRepo.updateProgress(importId, {
        processedProducts: i + 1,
        successCount,
        failedCount,
        skippedCount,
        failedProductDetails: failedProductDetails.slice(0, 100)
      });

      console.error(`[${i + 1}/${totalProducts}] Failed: ${product.title}: ${errMsg}`);
    }

    // Rate limiting delay between each Shopify API call
    await sleep(RATE_LIMIT_DELAY);
  }

  // Mark import job as completed/partial/failed
  if (failedCount >= totalProducts) {
    await importHistoryRepo.markFailed(importId, 'All products failed to import');
  } else {
    await importHistoryRepo.markCompleted(importId, {successCount, failedCount, skippedCount});
  }

  console.log(
    `Import ${importId} done: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`
  );
}
