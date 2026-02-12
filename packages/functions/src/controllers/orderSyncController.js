import {OrderSyncRepository} from '../repositories/orderSyncRepository.js';
import {OrderRepository} from '../repositories/orderRepository.js';
import {OrderSyncQueueRepository} from '../repositories/orderSyncQueueRepository.js';
import {OrderSyncJobRepository} from '../repositories/orderSyncJobRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';
import crypto from 'crypto';
import shopifyConfig from '../config/shopify.js';

const orderSyncRepo = new OrderSyncRepository();
const orderRepo = new OrderRepository();
const orderSyncQueueRepo = new OrderSyncQueueRepository();
const orderSyncJobRepo = new OrderSyncJobRepository();
const storeRepo = new StoreRepository();
const sheetRepo = new SheetRepository();

/**
 * Setup order sync configuration
 */
export async function setupSync(req, res) {
  try {
    const {userId, storeId, sheetId, sheetName, targetSheetId} = req.body;

    // Validate input
    if (!userId || !storeId || !sheetId) {
      return res.status(400).json({
        success: false,
        error: 'userId, storeId, and sheetId are required'
      });
    }

    // Get store and sheet
    const [store, sheet] = await Promise.all([
      storeRepo.getById(storeId),
      sheetRepo.getById(sheetId)
    ]);

    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    if (!sheet) {
      return res.status(404).json({success: false, error: 'Sheet not found'});
    }

    // Deactivate any existing sync configs for this store
    const existingConfigs = await orderSyncRepo.getSyncJobsByStore(storeId);
    for (const config of existingConfigs) {
      if (config.status === 'active') {
        await orderSyncRepo.updateSyncJob(config.id, {status: 'inactive'});
      }
    }

    // Create new sync configuration
    // Webhooks are managed declaratively via shopify.app.toml (auto-registered on install)
    const syncConfig = await orderSyncRepo.createSyncJob({
      userId,
      storeId,
      storeName: store.name,
      shopDomain: store.shopDomain,
      sheetId,
      sheetName: sheet.name,
      spreadsheetId: sheet.spreadsheetId,
      targetSheet: sheetName || 'Orders',
      targetSheetId: targetSheetId || null,
      status: 'active',
      totalOrdersSynced: 0
    });

    return res.json({
      success: true,
      message: 'Order sync configured successfully',
      data: syncConfig
    });
  } catch (error) {
    console.error('Setup sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process order sync queue (called by CronJob every minute)
 */
export async function processOrderSyncQueue() {
  const MAX_ATTEMPTS = 3;

  try {
    // Reset stuck items (once at start)
    const resetCount = await orderSyncQueueRepo.resetStuckItems(30);
    if (resetCount > 0) {
      console.log(`[OrderSync] Reset ${resetCount} stuck queue items`);
    }

    // Loop: process all pages continuously until no more pending items
    let hasMoreItems = true;
    while (hasMoreItems) {
      const pendingItems = await orderSyncQueueRepo.getPendingBatch(100);
      if (pendingItems.length === 0) {
        hasMoreItems = false;
        break;
      }

      console.log(`[OrderSync] Processing ${pendingItems.length} pending orders`);

      // Group by syncJobId to init sheets service once per job
      const jobGroups = {};
      for (const item of pendingItems) {
        if (!jobGroups[item.syncJobId]) {
          jobGroups[item.syncJobId] = [];
        }
        jobGroups[item.syncJobId].push(item);
      }

      for (const [syncJobId, items] of Object.entries(jobGroups)) {
        // Get sheet info and init service once per job
        let sheetsService = null;
        try {
          const sheet = await sheetRepo.getById(items[0].sheetId);
          sheetsService = sheet.credentials
            ? new GoogleSheetsService(sheet.credentials)
            : sheet.refreshToken
            ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
            : await GoogleSheetsService.createForUser(sheet.userId);
        } catch (error) {
          console.error(`[OrderSync] Failed to init sheets service for job ${syncJobId}:`, error);
          continue;
        }

        // Check if sheet is empty (needs headers)
        let sheetIsEmpty = false;
        try {
          const sheetData = await sheetsService.readSheet(
            items[0].spreadsheetId,
            `${items[0].targetSheet}!A1:A2`
          );
          sheetIsEmpty = !sheetData || sheetData.length === 0;
        } catch {
          sheetIsEmpty = true;
        }

        // Collect orders for batch append
        const ordersToAppend = [];
        const processedItemIds = [];

        for (const item of items) {
          try {
            if (item.attempts >= MAX_ATTEMPTS) {
              await orderSyncQueueRepo.markFailed(item.id, 'Max retries exceeded');
              await updateJobProgress(syncJobId, 'failed');
              continue;
            }

            // Mark as processing
            await orderSyncQueueRepo.updateStatus(item.id, 'processing');

            // Parse orderData (stored as JSON string to avoid Firestore nested array limitation)
            const parsedOrderData =
              typeof item.orderData === 'string' ? JSON.parse(item.orderData) : item.orderData;
            ordersToAppend.push(parsedOrderData);
            processedItemIds.push({...item, _parsedOrderData: parsedOrderData});
          } catch (error) {
            console.error(`[OrderSync] Error preparing item ${item.id}:`, error);
          }
        }

        if (ordersToAppend.length === 0) continue;

        // Batch write to Google Sheets
        try {
          if (sheetIsEmpty) {
            await sheetsService.writeOrders(
              items[0].spreadsheetId,
              items[0].targetSheet,
              ordersToAppend
            );
          } else {
            await sheetsService.appendOrders(
              items[0].spreadsheetId,
              items[0].targetSheet,
              ordersToAppend
            );
          }

          // Mark all as completed and track
          for (const item of processedItemIds) {
            try {
              await orderSyncQueueRepo.updateStatus(item.id, 'completed');
              await orderRepo.saveOrder({
                orderId: item.orderId || item._parsedOrderData?.orderId,
                orderNumber: item.orderNumber || item._parsedOrderData?.orderNumber,
                storeId: item.storeId,
                syncedToSheet: true,
                lastSheetSync: new Date().toISOString()
              });
              await orderSyncRepo.trackSyncedOrder({
                storeId: item.storeId,
                shopifyOrderId: item.orderId || item._parsedOrderData?.orderId,
                orderNumber: item.orderNumber || item._parsedOrderData?.orderNumber
              });
              await updateJobProgress(syncJobId, 'success');
            } catch (error) {
              console.error(`[OrderSync] Error marking item ${item.id} completed:`, error);
            }
          }
        } catch (error) {
          console.error(`[OrderSync] Sheet write failed for job ${syncJobId}:`, error);
          // Mark all as pending for retry
          for (const item of processedItemIds) {
            try {
              const attempts = await orderSyncQueueRepo.incrementAttempts(item.id);
              if (attempts >= MAX_ATTEMPTS) {
                await orderSyncQueueRepo.markFailed(item.id, error.message);
                await updateJobProgress(syncJobId, 'failed');
              } else {
                await orderSyncQueueRepo.updateStatus(item.id, 'pending', error.message);
              }
            } catch (err) {
              console.error(`[OrderSync] Error handling retry for ${item.id}:`, err);
            }
          }
        }

        // Check if job is complete (will fetchNextPage and enqueue more if hasNextPage)
        await checkAndCompleteJob(syncJobId);
      }
    }

    // Cleanup old completed items
    await orderSyncQueueRepo.cleanup(7);
  } catch (error) {
    console.error('[OrderSync] Queue processing error:', error);
  }
}

/**
 * Update job progress counters
 */
async function updateJobProgress(syncJobId, result) {
  try {
    const job = await orderSyncJobRepo.getById(syncJobId);
    if (!job) return;

    const updates = {
      processedOrders: (job.processedOrders || 0) + 1
    };

    if (result === 'success') {
      updates.successCount = (job.successCount || 0) + 1;
    } else if (result === 'failed') {
      updates.failedCount = (job.failedCount || 0) + 1;
    }

    await orderSyncJobRepo.update(syncJobId, updates);
  } catch (error) {
    console.error(`[OrderSync] Error updating job progress:`, error);
  }
}

/**
 * Check if current page is done and either fetch next page or complete job
 */
async function checkAndCompleteJob(syncJobId) {
  try {
    const job = await orderSyncJobRepo.getById(syncJobId);
    if (!job || job.status !== 'processing') {
      console.log(
        `[OrderSync] checkAndCompleteJob: skipping job ${syncJobId} (exists: ${!!job}, status: ${
          job?.status
        })`
      );
      return;
    }

    const stats = await orderSyncQueueRepo.getQueueStatsByJobId(syncJobId);
    console.log(
      `[OrderSync] checkAndCompleteJob: job ${syncJobId} stats: pending=${stats.pending}, processing=${stats.processing}, completed=${stats.completed}, failed=${stats.failed}`
    );
    if (stats.pending > 0 || stats.processing > 0) return;

    // Current page is done - check if there are more pages
    if (job.hasNextPage) {
      console.log(
        `[OrderSync] Job ${syncJobId} page ${job.currentPage} done, fetching next page...`
      );
      await fetchNextPage(syncJobId);
      return;
    }

    // All pages done - job is complete
    await orderSyncJobRepo.update(syncJobId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    // Update sync config with last synced order ID
    const syncConfig = await orderSyncRepo.getActiveSyncConfig(job.storeId);
    if (syncConfig) {
      const updates = {
        totalOrdersSynced: (syncConfig.totalOrdersSynced || 0) + (job.successCount || 0)
      };
      if (job.lastOrderId) {
        updates.lastSyncedOrderId = job.lastOrderId;
      }
      await orderSyncRepo.updateSyncJob(syncConfig.id, updates);
    }

    console.log(
      `[OrderSync] Job ${syncJobId} completed: ${job.successCount} success, ${job.failedCount} failed, ${job.currentPage} pages`
    );
  } catch (error) {
    console.error(`[OrderSync] Error completing job:`, error);
  }
}

/**
 * Fetch next page of orders from Shopify and enqueue them
 */
async function fetchNextPage(syncJobId) {
  try {
    const job = await orderSyncJobRepo.getById(syncJobId);
    if (!job || !job.hasNextPage || !job.nextPageParams) {
      console.log(
        `[OrderSync] fetchNextPage: skipping job ${syncJobId} (exists: ${!!job}, hasNextPage: ${
          job?.hasNextPage
        }, nextPageParams: ${!!job?.nextPageParams})`
      );
      return;
    }

    console.log(
      `[OrderSync] fetchNextPage: starting for job ${syncJobId} (page: ${job.currentPage})`
    );

    const store = await storeRepo.getById(job.storeId);
    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Fetch next page using cursor-based pagination (page_info from previous response)
    const orders = await shopifyService.getOrders(job.nextPageParams);

    const hasNextPage = !!orders.nextPageParameters;
    const nextPageParams = orders.nextPageParameters || null;
    const nextPage = (job.currentPage || 1) + 1;
    // Track max order ID for saving lastSyncedOrderId after completion
    const pageMaxId =
      orders.length > 0 ? Math.max(...orders.map(o => Number(o.id))).toString() : null;
    const lastOrderId =
      pageMaxId && Number(pageMaxId) > Number(job.lastOrderId || '0') ? pageMaxId : job.lastOrderId;

    console.log(
      `[OrderSync] fetchNextPage: fetched ${orders.length} orders (page ${nextPage}, hasNextPage: ${hasNextPage})`
    );

    // Filter duplicates
    const formattedOrders = orders.map(formatOrderRowsForSheet);
    const newOrders = [];
    for (const order of formattedOrders) {
      const alreadySynced = await orderSyncRepo.isOrderSynced(job.storeId, order.orderId);
      if (!alreadySynced) {
        newOrders.push(order);
      }
    }

    // Enqueue new orders
    // Note: orderData is JSON-stringified because Firestore doesn't support nested arrays (rows: [[...]])
    for (const order of newOrders) {
      await orderSyncQueueRepo.enqueue({
        syncJobId,
        storeId: job.storeId,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        orderData: JSON.stringify(order),
        sheetId: job.sheetId,
        spreadsheetId: job.spreadsheetId,
        targetSheet: job.targetSheet
      });
    }

    // Update job pagination state
    await orderSyncJobRepo.update(syncJobId, {
      nextPageParams,
      lastOrderId,
      hasNextPage,
      currentPage: nextPage,
      totalOrders: (job.totalOrders || 0) + newOrders.length
    });

    console.log(
      `[OrderSync] Enqueued ${newOrders.length} orders for job ${syncJobId} (page ${nextPage}, hasNextPage: ${hasNextPage})`
    );

    // If all orders on this page were already synced, continue immediately
    if (newOrders.length === 0) {
      await checkAndCompleteJob(syncJobId);
    }
  } catch (error) {
    console.error(`[OrderSync] Error fetching next page for job ${syncJobId}:`, error);
  }
}

/**
 * Get order sync queue stats (for frontend polling)
 */
export async function getOrderSyncQueueStats(req, res) {
  try {
    const {storeId} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const queueStats = await orderSyncQueueRepo.getQueueStats();
    const activeJob = await orderSyncJobRepo.getActiveJob(storeId);
    let jobStats = null;

    if (activeJob) {
      jobStats = {
        ...activeJob,
        queueStats: await orderSyncQueueRepo.getQueueStatsByJobId(activeJob.id)
      };
    }

    return res.json({
      success: true,
      data: {queueStats, activeJob: jobStats}
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Re-sync failed orders from Firestore to Google Sheets
 */
export async function resyncFailedOrders(req, res) {
  try {
    const {storeId} = req.body;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    // Get sync configuration
    const syncConfig = await orderSyncRepo.getActiveSyncConfig(storeId);
    if (!syncConfig) {
      return res.status(404).json({
        success: false,
        error: 'No active sync configuration found'
      });
    }

    // Get failed orders from Firestore
    const failedOrders = await orderRepo.getOrdersForResync(storeId);

    if (failedOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No failed orders to re-sync',
        data: {resynced: 0}
      });
    }

    // Get sheet
    const sheet = await sheetRepo.getById(syncConfig.sheetId);
    const sheetsService = sheet.credentials
      ? new GoogleSheetsService(sheet.credentials)
      : sheet.refreshToken
      ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
      : await GoogleSheetsService.createForUser(sheet.userId);

    let resynced = 0;
    let failed = 0;

    // Try to sync each order
    for (const order of failedOrders) {
      try {
        await sheetsService.appendOrder(syncConfig.spreadsheetId, syncConfig.targetSheet, order);

        // Mark as synced
        await orderRepo.markSyncedToSheet(storeId, order.orderId);
        resynced++;
      } catch (error) {
        console.error(`Failed to re-sync order ${order.orderNumber}:`, error);
        await orderRepo.incrementSyncAttempt(storeId, order.orderId, error.message);
        failed++;
      }
    }

    return res.json({
      success: true,
      message: `Re-synced ${resynced} orders. ${failed} failed.`,
      data: {
        resynced,
        failed,
        total: failedOrders.length
      }
    });
  } catch (error) {
    console.error('Re-sync failed orders error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get sync statistics including Firestore backup status
 */
export async function getSyncStats(req, res) {
  try {
    const {storeId} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const stats = await orderRepo.getSyncStats(storeId);

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get sync stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get sync configurations
 */
export async function getSyncConfigs(req, res) {
  try {
    const {userId, storeId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    let configs;
    if (storeId) {
      configs = await orderSyncRepo.getSyncJobsByStore(storeId);
    } else {
      // Get all stores (standalone returns ALL, embed returns user-scoped)
      const stores =
        userId === 'default-user' ? await storeRepo.getAll() : await storeRepo.getByUser(userId);
      configs = [];
      for (const store of stores) {
        const storeConfigs = await orderSyncRepo.getSyncJobsByStore(store.id);
        configs.push(...storeConfigs);
      }
    }

    return res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Get sync configs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle incoming order webhook from Shopify
 */
export async function handleOrderWebhook(req, res) {
  try {
    const shopDomain = ShopifyService.normalizeShopDomain(req.get('X-Shopify-Shop-Domain'));
    const hmac = req.get('X-Shopify-Hmac-SHA256');
    const topic = req.get('X-Shopify-Topic');
    const order = req.body;

    console.log(`[WEBHOOK] ${topic} from ${shopDomain} | Order ${order?.name} (${order?.id})`);

    // Only process orders/create webhook
    if (topic !== 'orders/create') {
      return res.status(200).json({message: 'Only orders/create is processed'});
    }

    // Verify webhook authenticity
    const store = await storeRepo.getByShopDomain(shopDomain);
    if (!store) {
      console.error('[WEBHOOK] Store not found:', shopDomain);
      return res.status(404).json({error: 'Store not found'});
    }

    const rawBody = req.rawBody || JSON.stringify(req.body);
    if (!verifyWebhookHmac(rawBody, hmac, shopifyConfig.apiSecret)) {
      console.error('[WEBHOOK] HMAC verification failed for:', shopDomain);
      return res.status(401).json({error: 'Invalid webhook signature'});
    }

    // Get active sync configuration
    const syncConfig = await orderSyncRepo.getActiveSyncConfig(store.id);
    if (!syncConfig) {
      return res.status(200).json({message: 'No sync config, skipping'});
    }

    // Check if order was already synced (prevent duplicates)
    const alreadySynced = await orderSyncRepo.isOrderSynced(store.id, order.id.toString());
    if (alreadySynced) {
      return res.status(200).json({message: 'Already synced'});
    }

    // Format order for sheet (per-line-item rows)
    const formattedOrder = formatOrderRowsForSheet(order);

    // Save to Firestore first (backup)
    try {
      await orderRepo.saveOrder({
        orderId: formattedOrder.orderId,
        orderNumber: formattedOrder.orderNumber,
        storeId: store.id,
        syncConfigId: syncConfig.id
      });
    } catch (error) {
      console.error('[WEBHOOK] Firestore save failed:', error.message);
    }

    // Sync to Google Sheets
    try {
      const sheet = await sheetRepo.getById(syncConfig.sheetId);
      const sheetsService = sheet.credentials
        ? new GoogleSheetsService(sheet.credentials)
        : sheet.refreshToken
        ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
        : await GoogleSheetsService.createForUser(sheet.userId);

      await sheetsService.appendOrder(
        syncConfig.spreadsheetId,
        syncConfig.targetSheet,
        formattedOrder
      );

      await orderSyncRepo.trackSyncedOrder({
        storeId: store.id,
        shopifyOrderId: order.id.toString(),
        orderNumber: order.name
      });
      await orderRepo.markSyncedToSheet(store.id, formattedOrder.orderId);
      await orderSyncRepo.updateSyncJob(syncConfig.id, {
        totalOrdersSynced: (syncConfig.totalOrdersSynced || 0) + 1,
        lastSyncAt: new Date().toISOString()
      });

      console.log(`[WEBHOOK] Synced ${order.name} to sheet (${formattedOrder.rows.length} rows)`);
      return res.status(200).json({success: true, message: 'Order synced', syncedToSheet: true});
    } catch (error) {
      console.error(`[WEBHOOK] Sheet sync failed for ${order.name}:`, error.message);
      await orderRepo.incrementSyncAttempt(store.id, formattedOrder.orderId, error.message);
      return res.status(200).json({success: true, message: 'Saved to Firestore, sheet sync failed', syncedToSheet: false});
    }
  } catch (error) {
    console.error('[WEBHOOK] Fatal error:', error.message);
    return res.status(500).json({error: error.message});
  }
}

/**
 * Format Shopify order data for Google Sheets rows (1 row per line item)
 * Returns { orderId, orderNumber, rows: [[...], [...]] }
 *
 * Columns: STT | Order Number | Customer Name | Email | Created at | Financial Status |
 *   Fulfillment Status | Quantity | Product name | Product SKU | Lineitem price |
 *   Shipping Country | Payment Method | Total | Tax Total | Discount | Note |
 *   Shipping Name | Shipping Address | Shipping City | Shipping Zip |
 *   Shipping State | Shipping Country Code | Shipping Phone | Custom name | Design
 */
function formatOrderRowsForSheet(order) {
  const customer = order.customer || {};
  const shippingAddress = order.shipping_address || {};
  const lineItems = order.line_items || [];

  const orderNumber = order.name || '';
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || shippingAddress.name || '';
  const email = order.email || customer.email || '';
  const createdAt = order.created_at || '';
  const financialStatus = order.financial_status || '';
  const fulfillmentStatus = order.fulfillment_status || 'unfulfilled';
  const paymentMethod = order.payment_gateway_names?.join(', ') || '';
  const totalPrice = order.total_price || '0';
  const totalTax = order.total_tax || '0';
  const discount = order.total_discounts || '0';
  const note = order.note || '';
  const shippingName = shippingAddress.name || '';
  const shippingFullAddr = [shippingAddress.address1, shippingAddress.address2].filter(Boolean).join(', ');
  const shippingCity = shippingAddress.city || '';
  const shippingZip = shippingAddress.zip || '';
  const shippingState = shippingAddress.province || '';
  const shippingCountryCode = shippingAddress.country_code || '';
  const shippingPhone = shippingAddress.phone || '';

  const buildRow = (item, index) => {
    const props = (item.properties || []).filter(p => p.name && !p.name.startsWith('_'));
    const nameProp = props.find(p => /name/i.test(p.name));
    const designProp = props.find(p => /design/i.test(p.name));
    const customName = nameProp ? `${nameProp.name}: ${nameProp.value}` : '';
    const design = designProp ? `${designProp.name}: ${designProp.value}` : '';

    return [
      '',                                     // STT (auto-filled)
      orderNumber,                            // Order Number
      index === 0 ? customerName : '',        // Customer Name
      index === 0 ? email : '',               // Email
      index === 0 ? createdAt : '',           // Created at
      index === 0 ? financialStatus : '',     // Financial Status
      index === 0 ? fulfillmentStatus : '',   // Fulfillment Status
      item.quantity || 1,                     // Quantity
      item.name || item.title || '',          // Product name
      item.sku || '',                         // Product SKU
      item.price || '0',                      // Lineitem price
      index === 0 ? (shippingAddress.country || '') : '', // Shipping Country
      index === 0 ? paymentMethod : '',       // Payment Method
      index === 0 ? totalPrice : '',          // Total
      index === 0 ? totalTax : '',            // Tax Total
      index === 0 ? discount : '',            // Discount
      index === 0 ? note : '',                // Note
      index === 0 ? shippingName : '',        // Shipping Name
      index === 0 ? shippingFullAddr : '',    // Shipping Address
      index === 0 ? shippingCity : '',        // Shipping City
      index === 0 ? shippingZip : '',         // Shipping Zip
      index === 0 ? shippingState : '',       // Shipping State
      index === 0 ? shippingCountryCode : '', // Shipping Country Code
      index === 0 ? shippingPhone : '',       // Shipping Phone
      customName,                             // Custom name
      design                                  // Design
    ];
  };

  const rows = lineItems.length > 0
    ? lineItems.map((item, index) => buildRow(item, index))
    : [buildRow({quantity: 0, name: '', sku: '', price: '0', properties: []}, 0)];

  return {
    orderId: order.id?.toString() || '',
    orderNumber,
    rows
  };
}

/**
 * Verify webhook HMAC signature
 */
function verifyWebhookHmac(data, hmac, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64');
  return hash === hmac;
}
