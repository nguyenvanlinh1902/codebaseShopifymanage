import {TrackingHistoryRepository} from '../repositories/trackingHistoryRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {TrackingStatusRepository} from '../repositories/tracking-status-repository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {paginateArray, parsePaginationParams} from '../utils/paginate-array.js';
import {
  parseTrackingExcel,
  validateTrackingRecord,
  mapToTrackingData,
  generateTrackingTemplate
} from '../helpers/excelParser.js';
import {getOrCreateTopic, publishMessage} from '../helpers/pubsubHelper.js';

const trackingHistoryRepo = new TrackingHistoryRepository();
const storeRepo = new StoreRepository();
const trackingStatusRepo = new TrackingStatusRepository();

const delay = ms => new Promise(r => setTimeout(r, ms));
// ~1.4 req/sec — safely under Shopify Basic plan limit (2 req/sec)
const THROTTLE_MS = 700;
// Max records per PubSub message (CF timeout = 540s; ~3.5s/record → ~150 max)
const BATCH_SIZE = 100;

/**
 * Retry a fn on Shopify 429 with Retry-After-aware backoff.
 * Max 6 attempts; respects Retry-After header, caps at 60s.
 */
async function retryOnRateLimit(fn, maxRetries = 6) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 =
        err.statusCode === 429 ||
        err.message?.includes('429') ||
        err.message?.includes('Too Many Requests');
      if (!is429 || attempt === maxRetries - 1) throw err;
      const retryAfterMs = err.retryAfter ? err.retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
      const waitMs = Math.min(retryAfterMs, 60000);
      console.warn(`[TrackingImport] 429 rate limit, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await delay(waitMs);
    }
  }
}

const TRACKING_IMPORT_TOPIC = 'tracking-import';

/**
 * Upload Excel and initiate tracking import
 */
export async function uploadAndImport(req, res) {
  try {
    const {storeId, excelBuffer, fileName} = req.body;
    const userId = req.body.userId || 'default-user';
    const trackingMode = req.body.trackingMode || 'add'; // 'add' or 'replace'

    // Task 1: Validate input
    if (!storeId || !excelBuffer) {
      return res.status(400).json({
        success: false,
        error: 'storeId and excelBuffer are required'
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
      trackingMode,
      invalidRecords: invalidRecords.length > 0 ? invalidRecords : []
    });

    // Task 6: Publish records in batches to PubSub (sequential processing per batch)
    // Batch size capped at BATCH_SIZE to stay within CF timeout (540s)
    await getOrCreateTopic(TRACKING_IMPORT_TOPIC);

    const publishPromises = [];
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const batch = validRecords.slice(i, i + BATCH_SIZE);
      publishPromises.push(
        publishMessage(TRACKING_IMPORT_TOPIC, {
          importId: importJob.id,
          storeId,
          shopDomain: store.shopDomain,
          accessToken: store.accessToken,
          records: batch,
          trackingMode,
          totalRecords: validRecords.length
        })
      );
    }

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
    const {storeId} = req.query;

    let imports;
    if (storeId) {
      imports = await trackingHistoryRepo.getByStore(storeId);
    } else {
      imports = await trackingHistoryRepo.getAll();
    }

    const {page, perPage, search} = parsePaginationParams(req.query);
    const result = paginateArray(imports, {
      page, perPage, search,
      searchKeys: ['fileName', 'storeName', 'status']
    });
    return res.json({success: true, ...result});
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
 * Get flattened tracking records across all imports
 * Supports filtering by storeId or groupId (comma-separated storeIds)
 */
export async function getTrackingRecords(req, res) {
  try {
    const {storeId, storeIds} = req.query;

    let imports;
    if (storeIds) {
      const ids = storeIds.split(',').filter(Boolean);
      imports = await trackingHistoryRepo.getByStoreIds(ids);
    } else if (storeId) {
      imports = await trackingHistoryRepo.getByStore(storeId);
    } else {
      imports = await trackingHistoryRepo.getAll(200);
    }

    // Flatten trackingDetails from all imports
    const records = [];
    for (const imp of imports) {
      if (!imp.trackingDetails || imp.trackingDetails.length === 0) continue;
      for (const detail of imp.trackingDetails) {
        records.push({
          ...detail,
          importId: imp.id,
          storeId: imp.storeId,
          storeName: imp.storeName,
          shopDomain: imp.shopDomain,
          source: imp.fileName,
          importDate: imp.createdAt
        });
      }
    }

    // Sort by updatedAt desc
    records.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const {page, perPage, search} = parsePaginationParams(req.query);
    const result = paginateArray(records, {
      page, perPage, search,
      searchKeys: ['orderNumber', 'trackingNumber', 'carrier', 'storeName']
    });
    return res.json({success: true, ...result});
  } catch (error) {
    console.error('Get tracking records error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Background handler: Process tracking import batch from PubSub.
 * Processes records sequentially with throttling to avoid Shopify 429s.
 * Backward compatible: supports both batch format {records:[]} and legacy {trackingData:{}}.
 */
export async function processTrackingImport(messageData) {
  const data = messageData.message.json;
  const {importId, storeId, shopDomain, accessToken, totalRecords, trackingMode} = data;

  // Support both new batch format and legacy single-record format
  const records = data.records || [data.trackingData];

  const shopifyService = new ShopifyService({shopDomain, accessToken});
  let successCount = 0;
  let failedCount = 0;

  for (const trackingData of records) {
    const {orderNumber, trackingNumber, trackingCompany, trackingUrl} = trackingData;

    try {
      // Throttle before each Shopify API call group (~1.4 req/sec)
      await delay(THROTTLE_MS);
      const order = await retryOnRateLimit(() => shopifyService.getOrderByNumber(orderNumber));
      if (!order) throw new Error(`Order ${orderNumber} not found`);

      await delay(THROTTLE_MS);
      await retryOnRateLimit(() =>
        shopifyService.addOrderTracking(order.id, {trackingNumber, trackingCompany, trackingUrl}, trackingMode || 'add')
      );

      await trackingHistoryRepo.addTrackingDetail(importId, {
        orderNumber,
        trackingNumber,
        carrier: trackingCompany || '',
        success: true,
        updatedAt: new Date().toISOString()
      });
      successCount++;

      // Auto-push to tracking-status (non-blocking)
      try {
        const existing = await trackingStatusRepo.getByTrackingNumber(trackingNumber);
        if (!existing) {
          await trackingStatusRepo.create({
            trackingNumber,
            orderNumber: orderNumber || '',
            storeId: storeId || '',
            carrier: trackingCompany || '',
            status: 'pending',
            isRegistered: false,
            isDelivered: false
          });
        }
      } catch (pushErr) {
        console.error(`[TrackingImport] Auto-push failed for ${trackingNumber}:`, pushErr.message);
      }
    } catch (error) {
      console.error(`[TrackingImport] Failed order ${orderNumber}:`, error.message);
      await trackingHistoryRepo.addTrackingDetail(importId, {
        orderNumber,
        trackingNumber,
        carrier: trackingCompany || '',
        success: false,
        error: error.message || 'Unknown error',
        updatedAt: new Date().toISOString()
      });
      failedCount++;
    }

    // Update progress after each record (no race conditions — sequential execution)
    await trackingHistoryRepo.updateProgress(importId, {
      processedRecords: successCount + failedCount,
      successCount,
      failedCount
    });
  }

  // Mark job complete after all records in this batch are processed
  const importJob = await trackingHistoryRepo.getById(importId);
  const totalProcessed = (importJob.processedRecords || 0);
  if (totalProcessed >= (totalRecords || records.length)) {
    if (successCount === 0 && failedCount > 0) {
      await trackingHistoryRepo.markFailed(importId, 'All tracking updates failed');
    } else {
      await trackingHistoryRepo.markCompleted(importId, {
        successCount: importJob.successCount || 0,
        failedCount: importJob.failedCount || 0
      });
    }
  }
}
