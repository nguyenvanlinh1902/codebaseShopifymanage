import {TrackingHistoryRepository} from '../repositories/trackingHistoryRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';
import {
  parseTrackingExcel,
  validateTrackingRecord,
  mapToTrackingData,
  convertRowsToRecords,
  generateTrackingTemplate
} from '../helpers/excelParser.js';
import {getOrCreateTopic, publishMessage} from '../helpers/pubsubHelper.js';

const trackingHistoryRepo = new TrackingHistoryRepository();
const storeRepo = new StoreRepository();
const sheetRepo = new SheetRepository();

const TRACKING_IMPORT_TOPIC = 'tracking-import';

/**
 * Upload Excel and initiate tracking import
 */
export async function uploadAndImport(req, res) {
  try {
    const {userId, storeId, excelBuffer, fileName} = req.body;

    // Task 1: Validate input
    if (!userId || !storeId || !excelBuffer) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, and excelBuffer are required'
      });
    }

    // Task 2: Get store information
    const store = await storeRepo.getById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Task 3: Parse Excel
    let trackingRecords;
    try {
      // Convert base64 to buffer if needed
      const buffer = Buffer.isBuffer(excelBuffer)
        ? excelBuffer
        : Buffer.from(excelBuffer, 'base64');

      trackingRecords = parseTrackingExcel(buffer);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: `Failed to parse Excel file: ${error.message}`
      });
    }

    if (trackingRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tracking records found in Excel file'
      });
    }

    // Task 4: Validate and map tracking records
    const validRecords = [];
    const invalidRecords = [];

    trackingRecords.forEach((record, index) => {
      const errors = validateTrackingRecord(record);
      if (errors.length > 0) {
        invalidRecords.push({
          row: index + 2, // +2 because index starts at 0 and there's a header
          record,
          errors
        });
      } else {
        validRecords.push(mapToTrackingData(record));
      }
    });

    if (validRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid tracking records found in Excel',
        invalidRecords
      });
    }

    // Task 5: Create import job record
    const importJob = await trackingHistoryRepo.create({
      userId,
      storeId,
      storeName: store.name,
      shopDomain: store.shopDomain,
      fileName: fileName || 'upload.xlsx',
      totalRecords: validRecords.length,
      processedRecords: 0,
      successCount: 0,
      failedCount: 0,
      status: 'pending',
      invalidRecords: invalidRecords.length > 0 ? invalidRecords : []
    });

    // Task 6: Publish tracking records to PubSub queue for background processing
    // Auto-creates topic if it doesn't exist (useful for local emulator)
    await getOrCreateTopic(TRACKING_IMPORT_TOPIC);

    // Publish each record as a separate message for parallel processing
    const publishPromises = validRecords.map((record, index) => {
      const message = {
        importId: importJob.id,
        storeId,
        shopDomain: store.shopDomain,
        accessToken: store.accessToken,
        trackingData: record,
        recordIndex: index,
        totalRecords: validRecords.length
      };

      return publishMessage(TRACKING_IMPORT_TOPIC, message);
    });

    await Promise.all(publishPromises);

    // Task 7: Update import status to processing
    await trackingHistoryRepo.updateProgress(importJob.id, {
      status: 'processing'
    });

    return res.json({
      success: true,
      message: `Import job created. Processing ${validRecords.length} tracking records in background.`,
      data: {
        importId: importJob.id,
        totalRecords: validRecords.length,
        invalidRecords: invalidRecords.length
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
 * Get import history for a user
 */
export async function getImportHistory(req, res) {
  try {
    const {userId, storeId} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    let imports;
    if (storeId) {
      imports = await trackingHistoryRepo.getByStore(storeId);
    } else if (userId === 'default-user') {
      imports = await trackingHistoryRepo.getAll();
    } else {
      imports = await trackingHistoryRepo.getByUser(userId);
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

    const importJob = await trackingHistoryRepo.getById(importId);

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
 * Download Excel template
 */
export async function downloadTemplate(req, res) {
  try {
    const template = generateTrackingTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="tracking-import-template.xlsx"');
    return res.send(template);
  } catch (error) {
    console.error('Download template error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Initialize GoogleSheetsService from sheet document (3-tier fallback)
 */
async function initSheetsService(sheet) {
  if (sheet.credentials) return new GoogleSheetsService(sheet.credentials);
  if (sheet.refreshToken) return GoogleSheetsService.createFromRefreshToken(sheet.refreshToken);
  return GoogleSheetsService.createForUser(sheet.userId);
}

/**
 * Preview tracking data from a Google Sheet tab
 */
export async function previewSheet(req, res) {
  try {
    const {sheetId, tabName} = req.query;

    if (!sheetId || !tabName) {
      return res.status(400).json({
        success: false,
        error: 'sheetId and tabName are required'
      });
    }

    const sheet = await sheetRepo.getById(sheetId);
    if (!sheet) {
      return res.status(404).json({success: false, error: 'Sheet not found'});
    }

    const sheetsService = await initSheetsService(sheet);
    const rows = await sheetsService.readSheet(sheet.spreadsheetId, `${tabName}`);
    const records = convertRowsToRecords(rows);

    // Validate and map for preview
    const preview = records.map((record, index) => {
      const errors = validateTrackingRecord(record);
      const mapped = errors.length === 0 ? mapToTrackingData(record) : null;
      return {
        row: index + 2,
        valid: errors.length === 0,
        errors,
        data: mapped || record
      };
    });

    return res.json({
      success: true,
      data: {
        records: preview,
        totalRows: records.length,
        validCount: preview.filter(r => r.valid).length,
        invalidCount: preview.filter(r => !r.valid).length
      }
    });
  } catch (error) {
    console.error('Preview sheet error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Import tracking from a Google Sheet tab (same PubSub flow as Excel)
 */
export async function importFromSheet(req, res) {
  try {
    const {userId, storeId, sheetId, tabName} = req.body;

    if (!userId || !storeId || !sheetId || !tabName) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, sheetId, and tabName are required'
      });
    }

    // Get store and sheet
    const store = await storeRepo.getById(storeId);
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    const sheet = await sheetRepo.getById(sheetId);
    if (!sheet) {
      return res.status(404).json({success: false, error: 'Sheet not found'});
    }

    // Read data from Google Sheet
    const sheetsService = await initSheetsService(sheet);
    const rows = await sheetsService.readSheet(sheet.spreadsheetId, `${tabName}`);
    const trackingRecords = convertRowsToRecords(rows);

    if (trackingRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tracking records found in sheet'
      });
    }

    // Validate and map (reuse same logic as Excel)
    const validRecords = [];
    const invalidRecords = [];

    trackingRecords.forEach((record, index) => {
      const errors = validateTrackingRecord(record);
      if (errors.length > 0) {
        invalidRecords.push({row: index + 2, record, errors});
      } else {
        validRecords.push(mapToTrackingData(record));
      }
    });

    if (validRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid tracking records found in sheet',
        invalidRecords
      });
    }

    // Create import job (same as Excel flow)
    const importJob = await trackingHistoryRepo.create({
      userId,
      storeId,
      storeName: store.name,
      shopDomain: store.shopDomain,
      fileName: `${sheet.title || sheet.name} / ${tabName}`,
      totalRecords: validRecords.length,
      processedRecords: 0,
      successCount: 0,
      failedCount: 0,
      status: 'pending',
      source: 'google_sheet',
      invalidRecords: invalidRecords.length > 0 ? invalidRecords : []
    });

    // Publish to PubSub (same topic as Excel)
    await getOrCreateTopic(TRACKING_IMPORT_TOPIC);

    const publishPromises = validRecords.map((record, index) => {
      const message = {
        importId: importJob.id,
        storeId,
        shopDomain: store.shopDomain,
        accessToken: store.accessToken,
        trackingData: record,
        recordIndex: index,
        totalRecords: validRecords.length
      };
      return publishMessage(TRACKING_IMPORT_TOPIC, message);
    });

    await Promise.all(publishPromises);

    await trackingHistoryRepo.updateProgress(importJob.id, {status: 'processing'});

    return res.json({
      success: true,
      message: `Import job created. Processing ${validRecords.length} tracking records in background.`,
      data: {
        importId: importJob.id,
        totalRecords: validRecords.length,
        invalidRecords: invalidRecords.length
      }
    });
  } catch (error) {
    console.error('Import from sheet error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Background handler: Process tracking import from PubSub
 * This runs in a separate Cloud Function triggered by PubSub
 */
export async function processTrackingImport(messageData) {
  // Firebase v2 onMessagePublished: event.data = {message: {json: ...}}
  const data = messageData.message.json;
  const {importId, shopDomain, accessToken, trackingData, totalRecords} = data;

  // Create Shopify service
  const shopifyService = new ShopifyService({
    shopDomain,
    accessToken
  });

  // Update order with tracking info
  try {
    const {orderNumber, trackingNumber, trackingCompany, trackingUrl} = trackingData;

    // Find order by order number
    const order = await shopifyService.getOrderByNumber(orderNumber);

    if (!order) {
      throw new Error(`Order ${orderNumber} not found`);
    }

    // Update order with tracking
    await shopifyService.addOrderTracking(order.id, {
      trackingNumber,
      trackingCompany,
      trackingUrl
    });

    // Update import progress (success)
    const importJob = await trackingHistoryRepo.getById(importId);
    await trackingHistoryRepo.updateProgress(importId, {
      processedRecords: (importJob.processedRecords || 0) + 1,
      successCount: (importJob.successCount || 0) + 1
    });

    // Check if this is the last record
    if ((importJob.processedRecords || 0) + 1 >= totalRecords) {
      await trackingHistoryRepo.markCompleted(importId, {
        successCount: (importJob.successCount || 0) + 1,
        failedCount: importJob.failedCount || 0
      });
    }
  } catch (error) {
    console.error(`Failed to update tracking for order ${trackingData.orderNumber}:`, error);

    // Update import progress (failure)
    const importJob = await trackingHistoryRepo.getById(importId);
    await trackingHistoryRepo.updateProgress(importId, {
      processedRecords: (importJob.processedRecords || 0) + 1,
      failedCount: (importJob.failedCount || 0) + 1
    });

    // Check if this is the last record
    if ((importJob.processedRecords || 0) + 1 >= totalRecords) {
      if ((importJob.failedCount || 0) + 1 >= totalRecords) {
        await trackingHistoryRepo.markFailed(importId, 'All tracking updates failed');
      } else {
        await trackingHistoryRepo.markCompleted(importId, {
          successCount: importJob.successCount || 0,
          failedCount: (importJob.failedCount || 0) + 1
        });
      }
    }

    // Don't rethrow - treat individual record failures as handled
    // (avoid PubSub retrying the same failed record)
  }
}
