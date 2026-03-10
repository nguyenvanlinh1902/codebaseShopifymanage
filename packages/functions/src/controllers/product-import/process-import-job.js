/**
 * Background handler: Process entire import job from PubSub
 * Always upserts: creates new products or merges variants into existing ones
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {ProductRepository} from '../../repositories/productRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';
import {StoreRepository} from '../../repositories/storeRepository.js';
import {callWithRetry, sleep, RATE_LIMIT_DELAY} from './retry-helpers.js';

const importHistoryRepo = new ImportHistoryRepository();
const productRepo = new ProductRepository();
const storeRepo = new StoreRepository();

/** Check if a Shopify error is daily variant creation throttle */
function isVariantThrottle(error) {
  return (
    error.message?.includes('Daily variant creation limit') ||
    error.extensions?.code === 'VARIANT_THROTTLE_EXCEEDED'
  );
}

/**
 * Process product import from PubSub message
 */
export async function processProductImport(messageData) {
  const data = messageData.message.json;
  const {importId, storeId, userId, storeName, shopDomain, accessToken, totalProducts} = data;

  // Validate accessToken before starting (don't enforce shpat_ prefix — legacy tokens are still valid)
  if (!accessToken) {
    const errMsg = `Missing access token for ${storeName} (${shopDomain}). Please reinstall the app.`;
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

  // Read products from Firestore subcollection (stored during upload, not sent via PubSub)
  const products = await importHistoryRepo.getImportProducts(importId);
  if (!products || products.length === 0) {
    const errMsg = 'No products found in import job';
    console.error(`Import ${importId} aborted: ${errMsg}`);
    await importHistoryRepo.markFailed(importId, errMsg);
    return;
  }

  let successCount = 0;
  let failedCount = 0;
  let processedVariants = 0;
  const failedProductDetails = [];

  console.log(`Starting import ${importId}: ${products.length} products for ${storeName}`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const variantCount = product.variants ? product.variants.length : 1;

    try {
      await importHistoryRepo.updateProductStatus(importId, i, 'processing');

      // Always upsert: create if new, merge variants if exists
      const {result, action, variantStats} = await callWithRetry(() =>
        shopifyService.upsertProduct(product)
      );

      // Save tracking record to Firestore
      await productRepo.save({
        importId,
        storeId,
        userId,
        storeName,
        shopDomain,
        shopifyProductId: result.id,
        action,
        importedAt: new Date().toISOString(),
        title: product.title,
        handle: product.handle,
        vendor: product.vendor,
        productType: product.productType,
        tags: product.tags,
        sku: product.variants?.[0]?.sku || '',
        price: product.variants?.[0]?.price || '0.00',
        variantCount
      });

      successCount++;
      processedVariants += variantCount;
      await importHistoryRepo.updateProductStatus(importId, i, 'completed');
      await importHistoryRepo.updateProgress(importId, {
        processedProducts: i + 1,
        processedVariants,
        successCount,
        failedCount
      });

      const statsMsg = action === 'updated'
        ? `+${variantStats.added} new, ${variantStats.updated} updated`
        : `${variantCount} variants`;
      console.log(`[${i + 1}/${products.length}] ${action}: ${product.title} (${statsMsg})`);
    } catch (error) {
      failedCount++;
      processedVariants += variantCount;
      const errMsg = error.message || 'Unknown error';
      failedProductDetails.push({title: product.title || 'Unknown', error: errMsg});

      await importHistoryRepo.updateProductStatus(importId, i, 'failed', errMsg);
      await importHistoryRepo.updateProgress(importId, {
        processedProducts: i + 1,
        processedVariants,
        successCount,
        failedCount,
        failedProductDetails: failedProductDetails.slice(0, 100)
      });

      console.error(`[${i + 1}/${products.length}] Failed: ${product.title}: ${errMsg}`);

      // Stop immediately on daily variant limit — remaining products cannot be processed today
      if (isVariantThrottle(error)) {
        const throttleMsg = `Daily variant creation limit reached for ${storeName} (${shopDomain}). Import stopped. Please retry tomorrow after midnight UTC.`;
        console.error(`Import ${importId} stopped: ${throttleMsg}`);
        await storeRepo.markVariantThrottled(storeId);
        await importHistoryRepo.markFailed(importId, throttleMsg);
        return;
      }
    }

    await sleep(RATE_LIMIT_DELAY);
  }

  // Mark import job as completed/failed
  if (failedCount >= products.length) {
    await importHistoryRepo.markFailed(importId, 'All products failed to import');
  } else {
    await importHistoryRepo.markCompleted(importId, {successCount, failedCount});
  }

  console.log(`Import ${importId} done: ${successCount} success, ${failedCount} failed`);
}
