import {StoreRepository} from '../repositories/storeRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {SyncJobRepository} from '../repositories/syncJobRepository.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';
import {ShopifyService} from '../services/shopifyService.js';

const storeRepo = new StoreRepository();
const sheetRepo = new SheetRepository();
const syncJobRepo = new SyncJobRepository();

/**
 * Product Controller
 * Handles product import/update from Google Sheets to Shopify
 */

/**
 * Import products from Google Sheets to Shopify
 */
export async function importProducts(req, res) {
  try {
    const {userId, storeId, sheetId, range, mode = 'create'} = req.body;

    if (!userId || !storeId || !sheetId || !range) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, sheetId, and range are required'
      });
    }

    // Get store and sheet
    const store = await storeRepo.getById(storeId);
    const sheet = await sheetRepo.getById(sheetId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }

    // Create sync job
    const job = await syncJobRepo.create({
      userId,
      storeId,
      sheetId,
      type: 'product_import',
      mode,
      range
    });

    // Process in background (don't wait)
    processProductImport(job.id, store, sheet, range, mode).catch(error => {
      console.error('Product import error:', error);
      syncJobRepo.updateStatus(job.id, 'failed', {error: error.message});
    });

    return res.json({
      success: true,
      message: 'Product import started',
      data: {
        jobId: job.id
      }
    });
  } catch (error) {
    console.error('Import products error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process product import (background task)
 */
async function processProductImport(jobId, store, sheet, range, mode) {
  try {
    // Update job status
    await syncJobRepo.updateStatus(jobId, 'processing');

    // Initialize services
    const sheetsService = new GoogleSheetsService(sheet.credentials);
    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Read products from sheet
    const rows = await sheetsService.readSheet(sheet.spreadsheetId, range);
    const products = sheetsService.parseProducts(rows);

    const results = {
      total: products.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Process each product
    for (const product of products) {
      try {
        if (mode === 'create') {
          // Create new product
          await shopifyService.createProduct(product);
          results.created++;
        } else if (mode === 'update') {
          // Update existing product by SKU
          const existing = await shopifyService.getProductBySku(product.sku);
          if (existing) {
            await shopifyService.updateProduct(existing.product.id, product);
            results.updated++;
          } else {
            results.skipped++;
            results.errors.push({
              sku: product.sku,
              error: 'Product not found'
            });
          }
        } else if (mode === 'upsert') {
          // Create or update
          const existing = await shopifyService.getProductBySku(product.sku);
          if (existing) {
            await shopifyService.updateProduct(existing.product.id, product);
            results.updated++;
          } else {
            await shopifyService.createProduct(product);
            results.created++;
          }
        }
      } catch (error) {
        console.error(`Error processing product ${product.title}:`, error);
        results.errors.push({
          product: product.title,
          error: error.message
        });
      }
    }

    // Update job with results
    await syncJobRepo.updateStatus(jobId, 'completed', results);
  } catch (error) {
    console.error('Process product import error:', error);
    await syncJobRepo.updateStatus(jobId, 'failed', {error: error.message});
    throw error;
  }
}

/**
 * Get import job status
 */
export async function getJobStatus(req, res) {
  try {
    const {jobId} = req.params;

    const job = await syncJobRepo.getById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    return res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Get job status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all jobs for a user
 */
export async function getJobs(req, res) {
  try {
    const {userId, storeId} = req.query;

    let jobs;
    if (storeId) {
      jobs = await syncJobRepo.getByStoreId(storeId);
    } else if (userId === 'default-user') {
      jobs = await syncJobRepo.getAll();
    } else if (userId) {
      jobs = await syncJobRepo.getByUserId(userId);
    } else {
      return res.status(400).json({
        success: false,
        error: 'userId or storeId is required'
      });
    }

    return res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
