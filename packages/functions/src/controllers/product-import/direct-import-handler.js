/**
 * Direct import handler - bypasses PubSub for debugging.
 * Processes CSV synchronously and returns detailed logs.
 */

import {ShopifyService} from '../../services/shopifyService.js';
import {AdminUserRepository} from '../../repositories/adminUserRepository.js';
import {
  buildFilesToProcess,
  parseAndValidateCsvFiles,
  validateAndFetchStores
} from './csv-upload-handler.js';
import {callWithRetry, sleep, RATE_LIMIT_DELAY} from './retry-helpers.js';
import {extractStoreIds} from '../../utils/store-access.js';

const adminUserRepo = new AdminUserRepository();

/**
 * Direct import: parse CSV and process products immediately (no PubSub).
 * Returns detailed per-product logs for debugging.
 */
export async function directImport(req, res) {
  try {
    const {storeId, storeIds, csvData, fileName, csvFiles} = req.body;

    const targetStoreIds = storeIds || (storeId ? [storeId] : []);

    // Auto-inject storeId from embed session
    if (req.store && targetStoreIds.length === 0) {
      targetStoreIds.push(req.store.id);
    }

    if (targetStoreIds.length === 0) {
      return res.status(400).json({success: false, error: 'No store selected'});
    }

    // Permission check: non-admin can only import to their assigned stores
    if (req.userRole !== 'admin') {
      const userRecord = await adminUserRepo.getById(req.userId);
      const assignedIds = extractStoreIds(userRecord?.assignedStores);
      const unauthorized = targetStoreIds.filter(id => !assignedIds.includes(id));
      if (unauthorized.length > 0) {
        return res.status(403).json({success: false, error: 'Access denied to one or more stores'});
      }
    }

    // Parse CSV files
    const filesToProcess = buildFilesToProcess(csvData, fileName, csvFiles);
    if (filesToProcess.length === 0) {
      return res.status(400).json({success: false, error: 'No CSV data provided'});
    }

    const {parsedFiles, fileErrors} = await parseAndValidateCsvFiles(filesToProcess);
    if (fileErrors.length > 0) {
      return res.status(400).json({success: false, error: 'CSV validation failed', fileErrors});
    }
    if (parsedFiles.length === 0) {
      return res.status(400).json({success: false, error: 'No valid products found'});
    }

    // Get store credentials
    const {stores, error: storeError} = await validateAndFetchStores(targetStoreIds);
    if (storeError) {
      return res.status(404).json({success: false, error: storeError});
    }

    const store = stores[0];
    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Verify credentials
    try {
      await shopifyService.verifyCredentials();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: `Cannot connect to ${store.name}: ${err.message}`
      });
    }

    // Process products directly
    const products = parsedFiles[0].validProducts;
    const logs = [];
    let successCount = 0;
    let failedCount = 0;

    const log = (level, msg, data) => {
      const entry = {time: new Date().toISOString(), level, msg, ...(data || {})};
      logs.push(entry);
      console[level === 'error' ? 'error' : 'log'](`[DirectImport] ${msg}`);
    };

    log('info', `Starting direct import: ${products.length} products to ${store.name} (${store.shopDomain})`);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const variantCount = product.variants ? product.variants.length : 1;
      const imageCount = product.images ? product.images.length : 0;

      log('info', `[${i + 1}/${products.length}] Processing: ${product.title} (${variantCount} variants, ${imageCount} images)`);

      try {
        const {result, action, variantStats} = await callWithRetry(() =>
          shopifyService.upsertProduct(product)
        );

        successCount++;
        const statsMsg = action === 'updated'
          ? `+${variantStats.added} new, ${variantStats.updated} updated`
          : `${variantCount} variants`;

        log('info', `[${i + 1}/${products.length}] ${action}: ${product.title} (${statsMsg})`, {
          action,
          shopifyProductId: result.id,
          variantStats
        });
      } catch (error) {
        failedCount++;
        const errDetail = error.response?.body?.errors || error.message;
        log('error', `[${i + 1}/${products.length}] FAILED: ${product.title}: ${JSON.stringify(errDetail)}`, {
          error: errDetail,
          handle: product.handle
        });
      }

      await sleep(RATE_LIMIT_DELAY);
    }

    log('info', `Import done: ${successCount} success, ${failedCount} failed out of ${products.length}`);

    return res.json({
      success: true,
      data: {
        store: {name: store.name, shopDomain: store.shopDomain},
        totalProducts: products.length,
        successCount,
        failedCount,
        logs
      }
    });
  } catch (error) {
    console.error('Direct import error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
