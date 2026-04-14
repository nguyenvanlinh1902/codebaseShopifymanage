/**
 * Product Import Controller
 * Main controller file - delegates to modular handlers.
 * Supports two flows:
 *   - Storage flow (new): batchId + fileNames → read from Firebase Storage
 *   - Legacy flow: csvFiles inline in JSON body
 */

import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {getOrCreateTopic, publishMessage} from '../helpers/pubsubHelper.js';
import {
  validateUploadInput,
  buildFilesToProcess,
  validateAndFetchStores,
  parseAndValidateCsvFiles,
  getCsvTemplate
} from './product-import/csv-upload-handler.js';
import {readAndMergeCsvFiles} from '../helpers/storage-csv-reader.js';
import {extractStoreIds} from '../utils/store-access.js';

// Re-export all route handlers
export {
  getImportHistory,
  getImportDetails,
  getImportStatus,
  getSuccessfulImports
} from './product-import/import-history-routes.js';

export {getProducts, getProductFilterOptions} from './product-import/product-query-routes.js';

// Re-export background processor
export {processProductImport} from './product-import/process-import-job.js';

const PRODUCT_IMPORT_TOPIC = 'product-import';
const importHistoryRepo = new ImportHistoryRepository();
const adminUserRepo = new AdminUserRepository();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Upload CSV and initiate product import.
 * Detects flow: batchId present → storage flow; csvFiles present → legacy flow.
 */
export async function uploadAndImport(req, res) {
  try {
    const {batchId, fileNames, storeId, storeIds, csvData, fileName, csvFiles, overwriteExisting} = req.body;
    const userId = req.userId;
    const isStorageFlow = !!batchId;

    if (isStorageFlow) {
      return await handleStorageFlow(req, res, {batchId, fileNames, storeIds, storeId, userId, overwriteExisting});
    }
    return await handleLegacyFlow(req, res, {storeIds, storeId, csvData, fileName, csvFiles, userId});
  } catch (error) {
    console.error('Upload and import error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** Storage-based flow: read CSVs from Firebase Storage, merge, 1 job per store. */
async function handleStorageFlow(req, res, {batchId, fileNames, storeIds, storeId, userId, overwriteExisting}) {
  // Validate batchId
  if (!UUID_REGEX.test(batchId)) {
    return res.status(400).json({success: false, error: 'Invalid batchId format'});
  }
  if (!fileNames?.length || fileNames.length > 100) {
    return res.status(400).json({success: false, error: 'fileNames required (max 100)'});
  }
  // Sanitize fileNames: no path traversal
  if (fileNames.some(f => f.includes('..') || f.includes('/') || f.includes('\\') || f.includes('\0'))) {
    return res.status(400).json({success: false, error: 'Invalid file name'});
  }

  const targetStoreIds = storeIds || (storeId ? [storeId] : []);
  if (targetStoreIds.length === 0) {
    return res.status(400).json({success: false, error: 'At least one store must be selected'});
  }

  // Permission check
  if (req.userRole !== 'admin') {
    const userRecord = await adminUserRepo.getById(userId);
    const assignedIds = extractStoreIds(userRecord?.assignedStores);
    const unauthorized = targetStoreIds.filter(id => !assignedIds.includes(id));
    if (unauthorized.length > 0) {
      return res.status(403).json({success: false, error: 'Access denied to one or more stores'});
    }
  }

  // Validate stores
  const {stores, error: storeError} = await validateAndFetchStores(targetStoreIds);
  if (storeError) return res.status(404).json({success: false, error: storeError});

  // Read & merge CSVs from Storage
  const {mergedProducts, invalidProducts, fileStats, errors: fileErrors} = await readAndMergeCsvFiles(batchId, fileNames);

  if (fileErrors.length > 0 && mergedProducts.length === 0) {
    return res.status(400).json({success: false, error: 'All files failed to parse', fileErrors});
  }
  if (mergedProducts.length === 0) {
    return res.status(400).json({success: false, error: 'No valid products found after merge'});
  }

  // Create 1 import job per store
  const importResults = await createImportJobs(stores, mergedProducts, {
    userId, fileNames, invalidProducts, overwriteExisting
  });

  const totalProducts = mergedProducts.length;
  const originalCount = fileStats.reduce((sum, f) => sum + f.productCount, 0);

  return res.json({
    success: true,
    message: `Import started. ${totalProducts} products queued for ${stores.length} store(s).`,
    data: {
      importResults,
      storesCount: stores.length,
      filesCount: fileNames.length,
      mergedProductCount: totalProducts,
      originalProductCount: originalCount,
      duplicatesRemoved: originalCount - totalProducts,
      fileStats,
      fileErrors: fileErrors.length > 0 ? fileErrors : undefined
    }
  });
}

/** Legacy flow: CSV data inline in JSON body (backward compat). */
async function handleLegacyFlow(req, res, {storeIds, storeId, csvData, fileName, csvFiles, userId}) {
  const targetStoreIds = storeIds || (storeId ? [storeId] : []);
  const filesToProcess = buildFilesToProcess(csvData, fileName, csvFiles);
  const inputError = validateUploadInput(userId, targetStoreIds, filesToProcess);
  if (inputError) return res.status(400).json({success: false, error: inputError});

  if (req.userRole !== 'admin') {
    const userRecord = await adminUserRepo.getById(userId);
    const assignedIds = extractStoreIds(userRecord?.assignedStores);
    const unauthorized = targetStoreIds.filter(id => !assignedIds.includes(id));
    if (unauthorized.length > 0) {
      return res.status(403).json({success: false, error: 'Access denied to one or more stores'});
    }
  }

  const {stores, error: storeError} = await validateAndFetchStores(targetStoreIds);
  if (storeError) return res.status(404).json({success: false, error: storeError});

  const {parsedFiles, fileErrors} = await parseAndValidateCsvFiles(filesToProcess);
  if (fileErrors.length > 0) {
    return res.status(400).json({success: false, error: 'File validation failed', fileErrors});
  }
  if (parsedFiles.length === 0) {
    return res.status(400).json({success: false, error: 'No valid files to process'});
  }

  // Legacy: 1 job per file per store
  const importResults = [];
  for (const store of stores) {
    for (const parsedFile of parsedFiles) {
      const jobs = await createImportJobs([store], parsedFile.validProducts, {
        userId, fileNames: [parsedFile.fileName], invalidProducts: parsedFile.invalidProducts
      });
      importResults.push(...jobs);
    }
  }

  return res.json({
    success: true,
    message: `Import started. ${parsedFiles.length} file(s) queued for ${stores.length} store(s).`,
    data: {importResults, storesCount: stores.length, filesCount: parsedFiles.length}
  });
}

/** Create import jobs and publish PubSub messages. Shared by both flows. */
async function createImportJobs(stores, products, {userId, fileNames, invalidProducts = [], overwriteExisting}) {
  const results = [];
  const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 1), 0);

  for (const store of stores) {
    const importJob = await importHistoryRepo.create({
      userId,
      storeId: store.id,
      storeName: store.name,
      shopDomain: store.shopDomain,
      fileName: fileNames.join(', '),
      totalProducts: products.length,
      totalVariants,
      processedProducts: 0,
      processedVariants: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      status: 'pending',
      overwriteExisting: overwriteExisting !== false,
      invalidProducts: invalidProducts.slice(0, 100),
      totalInvalidProducts: invalidProducts.length,
      failedProductDetails: [],
      products: products.map((p, i) => ({
        index: i, title: p.title || 'Unknown', handle: p.handle || '',
        variantCount: p.variants?.length || 1, status: 'pending', error: null
      }))
    });

    await importHistoryRepo.saveImportProducts(importJob.id, products);

    await getOrCreateTopic(PRODUCT_IMPORT_TOPIC);
    await publishMessage(PRODUCT_IMPORT_TOPIC, {
      importId: importJob.id,
      storeId: store.id,
      userId,
      storeName: store.name,
      shopDomain: store.shopDomain,
      totalProducts: products.length,
      overwriteExisting: overwriteExisting !== false
    });

    await importHistoryRepo.updateProgress(importJob.id, {status: 'processing'});

    results.push({
      storeId: store.id,
      storeName: store.name,
      importId: importJob.id,
      fileName: fileNames.join(', '),
      totalProducts: products.length,
      invalidProducts: invalidProducts.length
    });
  }

  return results;
}

/** Download CSV template */
export async function downloadTemplate(req, res) {
  try {
    const template = getCsvTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
    return res.send(template);
  } catch (error) {
    console.error('Download template error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
