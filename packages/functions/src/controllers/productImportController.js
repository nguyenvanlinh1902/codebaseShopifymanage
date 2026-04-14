/**
 * Product Import Controller
 * Upload CSVs to Firebase Storage → worker reads & imports via Bulk Operations.
 */

import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {getOrCreateTopic, publishMessage} from '../helpers/pubsubHelper.js';
import {validateAndFetchStores, getCsvTemplate} from './product-import/csv-upload-handler.js';
import {extractStoreIds} from '../utils/store-access.js';

// Re-export all route handlers
export {
  getImportHistory,
  getImportDetails,
  getImportStatus,
  getSuccessfulImports
} from './product-import/import-history-routes.js';


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

    if (!batchId) {
      return res.status(400).json({success: false, error: 'batchId is required. Upload files to Storage first.'});
    }
    return await handleStorageFlow(req, res, {batchId, fileNames, storeIds, storeId, userId, overwriteExisting});
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

  // Don't parse CSV here — let worker do it (avoids API timeout on large files)
  // Just create import jobs and send PubSub message with batchId + fileNames
  const importResults = await createImportJobsFromBatch(stores, {
    userId, fileNames, batchId, overwriteExisting
  });

  return res.json({
    success: true,
    message: `Import started. ${fileNames.length} file(s) queued for ${stores.length} store(s).`,
    data: {
      importResults,
      storesCount: stores.length,
      filesCount: fileNames.length
    }
  });
}

/** Create import jobs from batch metadata (no CSV parsing).
 * Worker will read + parse CSVs from Storage.
 */
async function createImportJobsFromBatch(stores, {userId, fileNames, batchId, overwriteExisting}) {
  const results = [];

  for (const store of stores) {
    const importJob = await importHistoryRepo.create({
      userId,
      batchId,
      storeId: store.id,
      storeName: store.name,
      shopDomain: store.shopDomain,
      fileName: fileNames.join(', '),
      totalProducts: 0, // Worker will update after parsing
      processedProducts: 0,
      successCount: 0,
      failedCount: 0,
      status: 'pending',
      overwriteExisting: overwriteExisting !== false,
      failedProductDetails: []
    });

    results.push({
      storeId: store.id,
      storeName: store.name,
      importId: importJob.id
    });
  }

  await getOrCreateTopic(PRODUCT_IMPORT_TOPIC);
  await publishMessage(PRODUCT_IMPORT_TOPIC, {
    importJobs: results.map(r => ({importId: r.importId, storeId: r.storeId, storeName: r.storeName})),
    batchId,
    fileNames,
    userId,
    overwriteExisting: overwriteExisting !== false
  });

  await Promise.all(results.map(r =>
    importHistoryRepo.updateProgress(r.importId, {status: 'processing'})
  ));

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

/**
 * Retry a failed import — re-trigger processing directly (no PubSub).
 * Useful for debugging: calls processProductImport synchronously and returns result.
 */
/**
 * Retry a failed import — calls processProductImport directly (no PubSub).
 * Returns detailed error info for debugging.
 */
export async function retryImport(req, res) {
  try {
    const {importId} = req.params;
    const job = await importHistoryRepo.getById(importId);
    if (!job) return res.status(404).json({success: false, error: 'Import not found'});

    // Reset status
    await importHistoryRepo.updateProgress(importId, {
      status: 'pending', processedProducts: 0, successCount: 0, failedCount: 0,
      statusMessage: 'Retrying...'
    });

    const {processProductImport} = await import('./product-import/process-import-job.js');

    // Reconstruct PubSub-like message
    await processProductImport({
      message: {
        json: {
          importJobs: [{importId, storeId: job.storeId, storeName: job.storeName}],
          batchId: job.batchId || null,
          fileNames: job.fileName?.split(', ') || [],
          userId: job.userId,
          totalProducts: job.totalProducts,
          overwriteExisting: job.overwriteExisting !== false
        }
      }
    });

    const updated = await importHistoryRepo.getById(importId);
    return res.json({
      success: true,
      data: {
        status: updated.status,
        successCount: updated.successCount,
        failedCount: updated.failedCount,
        error: updated.error,
        failedProductDetails: updated.failedProductDetails?.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Retry import error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
