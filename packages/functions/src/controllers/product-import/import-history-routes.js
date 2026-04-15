/**
 * Import history route handlers
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';

const importHistoryRepo = new ImportHistoryRepository();

/**
 * Get import history for a user
 */
export async function getImportHistory(req, res) {
  try {
    const {storeId} = req.query;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    let imports;
    if (storeId) {
      imports = await importHistoryRepo.getByStore(storeId);
    } else if (isAdmin) {
      imports = await importHistoryRepo.getAll(100);
    } else {
      imports = await importHistoryRepo.getByUser(userId);
    }

    return res.json({
      success: true,
      data: imports
    });
  } catch (error) {
    console.error('Get import history error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get import job details
 */
export async function getImportDetails(req, res) {
  try {
    const {importId} = req.params;

    const importJob = await importHistoryRepo.getById(importId);

    if (!importJob) {
      return res.status(404).json({
        success: false,
        error: 'Import job not found'
      });
    }

    return res.json({
      success: true,
      data: importJob
    });
  } catch (error) {
    console.error('Get import details error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get import job status with progress details
 * Designed for frontend polling
 */
export async function getImportStatus(req, res) {
  try {
    const {jobId} = req.params;

    const importJob = await importHistoryRepo.getById(jobId);

    if (!importJob) {
      return res.status(404).json({
        success: false,
        error: 'Import job not found'
      });
    }

    const totalProducts = importJob.totalProducts || 0;
    const totalVariants = importJob.totalVariants || 0;
    const processedProducts = importJob.processedProducts || 0;
    const processedVariants = importJob.processedVariants || 0;

    // Use variant-based percentage for finer progress (fallback to product-based)
    const completionPercentage = totalVariants > 0
      ? Math.round((processedVariants / totalVariants) * 100)
      : totalProducts > 0
        ? Math.round((processedProducts / totalProducts) * 100)
        : 0;

    const failedProducts = importJob.failedProductDetails || [];

    return res.json({
      success: true,
      data: {
        jobId: importJob.id,
        status: importJob.status,
        fileName: importJob.fileName,
        storeName: importJob.storeName,
        totalProducts,
        totalVariants,
        processedProducts,
        processedVariants,
        successCount: importJob.successCount || 0,
        failedCount: importJob.failedCount || 0,
        completionPercentage,
        failedProductDetails: failedProducts,
        products: importJob.products || [],
        createdAt: importJob.createdAt,
        completedAt: importJob.completedAt || null
      }
    });
  } catch (error) {
    console.error('Get import status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete an import history record (and its subcollection).
 * Only allows deletion of non-processing jobs to avoid breaking in-flight workers.
 */
export async function deleteImportHistory(req, res) {
  try {
    const {importId} = req.params;
    const job = await importHistoryRepo.getById(importId);

    if (!job) {
      return res.status(404).json({success: false, error: 'Import not found'});
    }

    await importHistoryRepo.delete(importId);
    return res.json({success: true});
  } catch (error) {
    console.error('Delete import history error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Get successful imports (stores that have been imported to)
 */
export async function getSuccessfulImports(req, res) {
  try {
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    const successfulImports = isAdmin
      ? await importHistoryRepo.getAllRecentSuccessful(20)
      : await importHistoryRepo.getRecentSuccessful(userId, 20);

    // Group by store
    const storeImports = {};
    successfulImports.forEach(imp => {
      if (!storeImports[imp.storeId]) {
        storeImports[imp.storeId] = {
          storeId: imp.storeId,
          storeName: imp.storeName,
          shopDomain: imp.shopDomain,
          imports: []
        };
      }
      storeImports[imp.storeId].imports.push({
        importId: imp.id,
        fileName: imp.fileName,
        totalProducts: imp.totalProducts,
        successCount: imp.results?.successCount || imp.successCount,
        completedAt: imp.completedAt
      });
    });

    return res.json({
      success: true,
      data: Object.values(storeImports)
    });
  } catch (error) {
    console.error('Get successful imports error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
