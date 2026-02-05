import {PubSub} from '@google-cloud/pubsub';
import {TrackingHistoryRepository} from '../repositories/trackingHistoryRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {parseTrackingExcel, validateTrackingRecord, mapToTrackingData, generateTrackingTemplate} from '../helpers/excelParser.js';

const pubsub = new PubSub();
const trackingHistoryRepo = new TrackingHistoryRepository();
const storeRepo = new StoreRepository();

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
      invalidRecords: invalidRecords.length > 0 ? invalidRecords : undefined
    });

    // Task 6: Publish tracking records to PubSub queue for background processing
    const topic = pubsub.topic(TRACKING_IMPORT_TOPIC);

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

      return topic.publishMessage({
        json: message
      });
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

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
 * Background handler: Process tracking import from PubSub
 * This runs in a separate Cloud Function triggered by PubSub
 */
export async function processTrackingImport(message) {
  try {
    const data = message.json;
    const {importId, storeId, shopDomain, accessToken, trackingData, recordIndex, totalRecords} = data;

    console.log(`Processing tracking record ${recordIndex + 1}/${totalRecords} for import ${importId}`);

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
      const result = await shopifyService.addOrderTracking(
        order.id,
        {
          trackingNumber,
          trackingCompany,
          trackingUrl
        }
      );

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

      console.log(`Successfully updated tracking for order ${orderNumber}`);
      message.ack();
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
          // All records failed
          await trackingHistoryRepo.markFailed(importId, 'All tracking updates failed');
        } else {
          // Some records succeeded
          await trackingHistoryRepo.markCompleted(importId, {
            successCount: importJob.successCount || 0,
            failedCount: (importJob.failedCount || 0) + 1
          });
        }
      }

      // Ack the message even on failure (don't retry indefinitely)
      message.ack();
    }
  } catch (error) {
    console.error('Process tracking import error:', error);
    // Nack the message to retry later
    message.nack();
  }
}
