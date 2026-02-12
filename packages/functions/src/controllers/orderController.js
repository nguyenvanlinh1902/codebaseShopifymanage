import {StoreRepository} from '../repositories/storeRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {SyncJobRepository} from '../repositories/syncJobRepository.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';
import {ShopifyService} from '../services/shopifyService.js';

const storeRepo = new StoreRepository();
const sheetRepo = new SheetRepository();
const syncJobRepo = new SyncJobRepository();

/**
 * Order Controller
 * Handles order sync from Shopify to Google Sheets
 */

/**
 * Sync orders from Shopify to Google Sheets
 */
export async function syncOrders(req, res) {
  try {
    const {userId, storeId, sheetId, sheetName = 'Orders', params = {}} = req.body;

    if (!userId || !storeId || !sheetId) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, and sheetId are required'
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
      type: 'order_sync',
      sheetName,
      params
    });

    // Process in background
    processOrderSync(job.id, store, sheet, sheetName, params).catch(error => {
      console.error('Order sync error:', error);
      syncJobRepo.updateStatus(job.id, 'failed', {error: error.message});
    });

    return res.json({
      success: true,
      message: 'Order sync started',
      data: {
        jobId: job.id
      }
    });
  } catch (error) {
    console.error('Sync orders error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process order sync (background task)
 */
async function processOrderSync(jobId, store, sheet, sheetName, params) {
  try {
    // Update job status
    await syncJobRepo.updateStatus(jobId, 'processing');

    // Initialize services
    const sheetsService = sheet.credentials
      ? new GoogleSheetsService(sheet.credentials)
      : sheet.refreshToken
      ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
      : await GoogleSheetsService.createForUser(sheet.userId);
    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Get orders from Shopify
    const orders = await shopifyService.getOrders(params);

    // Add store ID to each order
    const ordersWithStoreId = orders.map(order => ({
      ...order,
      storeId: store.id
    }));

    // Format for Google Sheets
    const rows = sheetsService.formatOrdersForExport(ordersWithStoreId);

    // Write to Google Sheets
    const range = `${sheetName}!A1:AC${rows.length}`;
    await sheetsService.writeSheet(sheet.spreadsheetId, range, rows);

    const results = {
      total: orders.length,
      synced: orders.length,
      sheetName,
      range
    };

    // Update job with results
    await syncJobRepo.updateStatus(jobId, 'completed', results);
  } catch (error) {
    console.error('Process order sync error:', error);
    await syncJobRepo.updateStatus(jobId, 'failed', {error: error.message});
    throw error;
  }
}

/**
 * Get orders from Shopify (preview)
 */
export async function getOrders(req, res) {
  try {
    const {storeId, limit = 10, status = 'any'} = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'storeId is required'
      });
    }

    const store = await storeRepo.getById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Initialize Shopify service
    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Get orders
    const orders = await shopifyService.getOrders({
      limit: parseInt(limit),
      status
    });

    return res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Schedule automatic order sync
 */
export async function scheduleOrderSync(req, res) {
  try {
    const {userId, storeId, sheetId, schedule = 'daily'} = req.body;

    if (!userId || !storeId || !sheetId) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, and sheetId are required'
      });
    }

    // TODO: Implement scheduled sync using Firebase Cloud Scheduler
    // For now, return success message

    return res.json({
      success: true,
      message: 'Scheduled sync will be implemented soon',
      data: {
        schedule,
        storeId,
        sheetId
      }
    });
  } catch (error) {
    console.error('Schedule order sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
