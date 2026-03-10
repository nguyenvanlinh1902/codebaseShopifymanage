/**
 * Queue management route handlers
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {ProductRepository} from '../../repositories/productRepository.js';
import {ProductQueueRepository} from '../../repositories/productQueueRepository.js';
import {processProductQueue} from './process-product-queue.js';

const importHistoryRepo = new ImportHistoryRepository();
const productRepo = new ProductRepository();
const productQueueRepo = new ProductQueueRepository();

/**
 * Get queue statistics
 */
export async function getQueueStats(req, res) {
  try {
    const {storeId} = req.query;

    let stats;
    let actualProductCount = 0;
    let activeImports = [];

    // If storeId provided (embedded app), filter by store and get actual product count
    if (storeId) {
      stats = await productQueueRepo.getQueueStatsByStore(storeId);
      actualProductCount = await productRepo.getCountByStore(storeId);

      // Get active import jobs
      const activeImportJobs = await importHistoryRepo.getActiveImports(storeId);
      activeImports = activeImportJobs.map(imp => ({
        importId: imp.id,
        fileName: imp.fileName,
        status: imp.status,
        totalProducts: imp.totalProducts,
        totalVariants: imp.totalVariants || 0,
        processedProducts: imp.processedProducts || 0,
        processedVariants: imp.processedVariants || 0,
        successCount: imp.successCount || 0,
        failedCount: imp.failedCount || 0,
        completionPercentage:
          imp.totalVariants > 0
            ? Math.round(((imp.processedVariants || 0) / imp.totalVariants) * 100)
            : imp.totalProducts > 0
              ? Math.round(((imp.processedProducts || 0) / imp.totalProducts) * 100)
              : 0
      }));
    } else {
      // Global stats (standalone app)
      stats = await productQueueRepo.getQueueStats();

      // Get all active import jobs across all stores
      const activeImportJobs = await importHistoryRepo.getAllActiveImports();
      activeImports = activeImportJobs.map(imp => ({
        importId: imp.id,
        fileName: imp.fileName,
        storeName: imp.storeName || 'Unknown',
        status: imp.status,
        totalProducts: imp.totalProducts,
        totalVariants: imp.totalVariants || 0,
        processedProducts: imp.processedProducts || 0,
        processedVariants: imp.processedVariants || 0,
        successCount: imp.successCount || 0,
        failedCount: imp.failedCount || 0,
        completionPercentage:
          imp.totalVariants > 0
            ? Math.round(((imp.processedVariants || 0) / imp.totalVariants) * 100)
            : imp.totalProducts > 0
              ? Math.round(((imp.processedProducts || 0) / imp.totalProducts) * 100)
              : 0
      }));
    }

    // Return both queue stats and actual product count
    return res.json({
      success: true,
      data: {
        ...stats,
        storeId: storeId || null, // Include storeId in response
        actualProductCount, // Actual number of successfully imported products
        activeImports // Active import jobs for auto-resume polling
      }
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get stuck imports (pending/processing with 0 progress for >2 min)
 */
export async function getStuckImports(req, res) {
  try {
    const stuckImports = await importHistoryRepo.getStuckImports(2, 20);
    return res.json({success: true, data: stuckImports});
  } catch (error) {
    console.error('Get stuck imports error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Retry a specific import by ID: reset status and trigger queue processing
 */
export async function retryImport(req, res) {
  try {
    const {importId} = req.params;
    if (!importId) {
      return res.status(400).json({success: false, error: 'importId required'});
    }

    const importJob = await importHistoryRepo.getById(importId);
    if (!importJob) {
      return res.status(404).json({success: false, error: 'Import job not found'});
    }

    // Reset to pending with 0 progress so rescueStuckImports picks it up
    await importHistoryRepo.updateProgress(importId, {
      status: 'pending',
      processedProducts: 0,
      processedVariants: 0,
      successCount: 0,
      failedCount: 0,
      failedProductDetails: []
    });

    // Clean up any existing queue items for this import
    const existingQueue = await productQueueRepo.getByImportId(importId);
    for (const item of existingQueue) {
      await productQueueRepo.updateStatus(item.id, 'failed', 'Cleared for retry');
    }

    // Trigger queue processing immediately (includes rescueStuckImports)
    await processProductQueue();

    const updated = await importHistoryRepo.getById(importId);
    return res.json({
      success: true,
      message: `Import ${importId} queued for retry`,
      data: updated
    });
  } catch (error) {
    console.error('Retry import error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Manual trigger: Process queue immediately
 */
export async function processQueueManual(req, res) {
  try {
    console.log('Manual queue processing triggered');

    // Run the queue processor
    await processProductQueue();

    // Get updated stats
    const stats = await productQueueRepo.getQueueStats();

    return res.json({
      success: true,
      message: 'Queue processing completed',
      data: stats
    });
  } catch (error) {
    console.error('Manual queue processing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
