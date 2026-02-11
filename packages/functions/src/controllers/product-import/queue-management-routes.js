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
        processedProducts: imp.processedProducts || 0,
        successCount: imp.successCount || 0,
        failedCount: imp.failedCount || 0,
        completionPercentage:
          imp.totalProducts > 0
            ? Math.round(((imp.processedProducts || 0) / imp.totalProducts) * 100)
            : 0
      }));
    } else {
      // Global stats (standalone app)
      stats = await productQueueRepo.getQueueStats();
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
