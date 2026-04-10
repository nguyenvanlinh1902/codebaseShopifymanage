import {StoreRepository} from '../repositories/storeRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {SyncJobRepository} from '../repositories/syncJobRepository.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';
import {ShopifyService} from '../services/shopifyService.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {hasStoreAccess} from '../utils/store-access.js';

const storeRepo = new StoreRepository();
const sheetRepo = new SheetRepository();
const syncJobRepo = new SyncJobRepository();
const authRepo = new GoogleAuthRepository();
const adminUserRepo = new AdminUserRepository();

/**
 * Tracking Controller
 * Handles tracking update from Google Sheets to Shopify
 */

/**
 * Update tracking info from Google Sheets to Shopify
 */
export async function updateTracking(req, res) {
  try {
    const {storeId, sheetId, range} = req.body;
    const userId = req.body.userId || 'default-user';

    if (!storeId || !sheetId || !range) {
      return res.status(400).json({
        success: false,
        error: 'storeId, sheetId, and range are required'
      });
    }

    // Check store access
    if (req.userRole !== 'admin') {
      const user = await adminUserRepo.getById(req.userId);
      if (!hasStoreAccess(user?.assignedStores, storeId)) {
        return res.status(403).json({success: false, error: 'Access denied to this store'});
      }
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
      type: 'tracking_update',
      range
    });

    // Process in background
    processTrackingUpdate(job.id, store, sheet, range).catch(error => {
      console.error('Tracking update error:', error);
      syncJobRepo.updateStatus(job.id, 'failed', {error: error.message});
    });

    return res.json({
      success: true,
      message: 'Tracking update started',
      data: {
        jobId: job.id
      }
    });
  } catch (error) {
    console.error('Update tracking error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process tracking update (background task)
 */
async function processTrackingUpdate(jobId, store, sheet, range) {
  try {
    // Update job status
    await syncJobRepo.updateStatus(jobId, 'processing');

    // Initialize services
    const sheetsService = sheet.credentials
      ? new GoogleSheetsService(sheet.credentials)
      : sheet.refreshToken
      ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
      : await GoogleSheetsService.createFromAnyAuth(authRepo);
    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Read tracking data from sheet
    const rows = await sheetsService.readSheet(sheet.spreadsheetId, range);
    const trackingData = sheetsService.parseTrackingData(rows);

    const results = {
      total: trackingData.length,
      updated: 0,
      created: 0,
      errors: []
    };

    // Process each tracking entry
    for (const tracking of trackingData) {
      try {
        const trackingInfo = {
          trackingNumber: tracking.trackingNumber,
          trackingCompany: tracking.trackingCompany || '',
          trackingUrl: tracking.trackingUrl || ''
        };

        if (tracking.fulfillmentId) {
          // Update existing fulfillment
          await shopifyService.updateFulfillmentTracking(
            tracking.orderId,
            tracking.fulfillmentId,
            trackingInfo
          );
          results.updated++;
        } else {
          // Create new fulfillment
          await shopifyService.createFulfillment(tracking.orderId, trackingInfo);
          results.created++;
        }

        // Mark as updated in sheet (optional)
        // You can update the status column back to the sheet here
      } catch (error) {
        console.error(`Error updating tracking for order ${tracking.orderId}:`, error);
        results.errors.push({
          orderId: tracking.orderId,
          error: error.message
        });
      }
    }

    // Update job with results
    await syncJobRepo.updateStatus(jobId, 'completed', results);
  } catch (error) {
    console.error('Process tracking update error:', error);
    await syncJobRepo.updateStatus(jobId, 'failed', {error: error.message});
    throw error;
  }
}

/**
 * Preview tracking data from sheet
 */
export async function previewTracking(req, res) {
  try {
    const {sheetId, range} = req.query;

    if (!sheetId || !range) {
      return res.status(400).json({
        success: false,
        error: 'sheetId and range are required'
      });
    }

    const sheet = await sheetRepo.getById(sheetId);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }

    // Initialize Google Sheets service (backward-compat)
    const sheetsService = sheet.credentials
      ? new GoogleSheetsService(sheet.credentials)
      : sheet.refreshToken
      ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
      : await GoogleSheetsService.createFromAnyAuth(authRepo);

    // Read tracking data
    const rows = await sheetsService.readSheet(sheet.spreadsheetId, range);
    const trackingData = sheetsService.parseTrackingData(rows);

    return res.json({
      success: true,
      data: {
        trackingData,
        count: trackingData.length
      }
    });
  } catch (error) {
    console.error('Preview tracking error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get fulfillments for an order
 */
export async function getOrderFulfillments(req, res) {
  try {
    const {storeId, orderId} = req.query;

    if (!storeId || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'storeId and orderId are required'
      });
    }

    // Check store access
    if (req.userRole !== 'admin') {
      const user = await adminUserRepo.getById(req.userId);
      if (!hasStoreAccess(user?.assignedStores, storeId)) {
        return res.status(403).json({success: false, error: 'Access denied to this store'});
      }
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

    // Get order with fulfillments
    const order = await shopifyService.getOrder(orderId);

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        fulfillments: order.fulfillments || []
      }
    });
  } catch (error) {
    console.error('Get order fulfillments error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
