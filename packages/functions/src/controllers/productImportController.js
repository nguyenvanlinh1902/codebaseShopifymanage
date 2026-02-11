/**
 * Product Import Controller
 * Main controller file - delegates to modular handlers
 */

import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {getOrCreateTopic, publishMessage} from '../helpers/pubsubHelper.js';
import {
  validateUploadInput,
  buildFilesToProcess,
  validateAndFetchStores,
  parseAndValidateCsvFiles,
  getCsvTemplate
} from './product-import/csv-upload-handler.js';

// Re-export all route handlers
export {
  getImportHistory,
  getImportDetails,
  getImportStatus,
  getSuccessfulImports
} from './product-import/import-history-routes.js';

export {getProducts, getProductFilterOptions} from './product-import/product-query-routes.js';

export {getQueueStats, processQueueManual} from './product-import/queue-management-routes.js';

// Re-export background processors
export {processProductImport} from './product-import/process-import-job.js';
export {processProductQueue} from './product-import/process-product-queue.js';

const PRODUCT_IMPORT_TOPIC = 'product-import';
const importHistoryRepo = new ImportHistoryRepository();

/**
 * Upload CSV and initiate product import
 * Supports multiple files + multiple stores
 * Flow: Validate ALL files first → only import if all pass → return real results
 */
export async function uploadAndImport(req, res) {
  try {
    const {userId, storeId, storeIds, csvData, fileName, csvFiles} = req.body;

    const targetStoreIds = storeIds || (storeId ? [storeId] : []);

    // Task 1: Validate input
    const filesToProcess = buildFilesToProcess(csvData, fileName, csvFiles);
    const inputError = validateUploadInput(userId, targetStoreIds, filesToProcess);

    if (inputError) {
      return res.status(400).json({success: false, error: inputError});
    }

    // Task 2: Get all store information
    const {stores, error: storeError} = await validateAndFetchStores(targetStoreIds);
    if (storeError) {
      return res.status(404).json({success: false, error: storeError});
    }

    // Task 3: Parse & validate ALL files first (fail fast)
    const {parsedFiles, fileErrors} = await parseAndValidateCsvFiles(filesToProcess);

    // If any file failed validation → stop everything, return errors
    if (fileErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${fileErrors.length} file(s) failed validation. Fix all files before importing.`,
        fileErrors
      });
    }

    if (parsedFiles.length === 0) {
      return res.status(400).json({success: false, error: 'No valid files to process'});
    }

    // Task 4: All files valid → Create import jobs and publish to Pub/Sub
    const importResults = [];

    for (const store of stores) {
      for (const parsedFile of parsedFiles) {
        // Create import job record (status: pending)
        const importJob = await importHistoryRepo.create({
          userId,
          storeId: store.id,
          storeName: store.name,
          shopDomain: store.shopDomain,
          fileName: parsedFile.fileName,
          totalProducts: parsedFile.validProducts.length,
          processedProducts: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          status: 'pending',
          invalidProducts:
            parsedFile.invalidProducts.length > 0 ? parsedFile.invalidProducts.slice(0, 100) : [],
          totalInvalidProducts: parsedFile.invalidProducts.length,
          failedProductDetails: [],
          products: parsedFile.validProducts.map((p, i) => ({
            index: i,
            title: p.title || 'Unknown',
            handle: p.handle || '',
            sku: p.sku || '',
            status: 'pending',
            error: null
          }))
        });

        // Publish ONE message per import job (sequential processing avoids 429 rate limits)
        await getOrCreateTopic(PRODUCT_IMPORT_TOPIC);
        await publishMessage(PRODUCT_IMPORT_TOPIC, {
          importId: importJob.id,
          storeId: store.id,
          userId,
          storeName: store.name,
          shopDomain: store.shopDomain,
          accessToken: store.accessToken,
          products: parsedFile.validProducts,
          totalProducts: parsedFile.validProducts.length
        });

        // Update status to processing
        await importHistoryRepo.updateProgress(importJob.id, {
          status: 'processing'
        });

        importResults.push({
          storeId: store.id,
          storeName: store.name,
          importId: importJob.id,
          fileName: parsedFile.fileName,
          totalProducts: parsedFile.validProducts.length,
          invalidProducts: parsedFile.invalidProducts.length
        });
      }
    }

    return res.json({
      success: true,
      message: `Import started. ${parsedFiles.length} file(s) queued for ${stores.length} store(s).`,
      data: {
        importResults,
        storesCount: stores.length,
        filesCount: parsedFiles.length
      }
    });
  } catch (error) {
    console.error('Upload and import error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Download CSV template
 */
export async function downloadTemplate(req, res) {
  try {
    const template = getCsvTemplate();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
    return res.send(template);
  } catch (error) {
    console.error('Download template error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
