import {OrderSyncRepository} from '../repositories/orderSyncRepository.js';
import {OrderRepository} from '../repositories/orderRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';
import crypto from 'crypto';

const orderSyncRepo = new OrderSyncRepository();
const orderRepo = new OrderRepository();
const storeRepo = new StoreRepository();
const sheetRepo = new SheetRepository();

/**
 * Setup order sync configuration
 */
export async function setupSync(req, res) {
  try {
    const {userId, storeId, sheetId, sheetName, webhookUrl} = req.body;

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
    const syncConfig = await orderSyncRepo.createSyncJob({
      userId,
      storeId,
      storeName: store.name,
      shopDomain: store.shopDomain,
      sheetId,
      sheetName: sheet.name,
      spreadsheetId: sheet.spreadsheetId,
      targetSheet: sheetName || 'Orders',
      status: 'active',
      webhookUrl: webhookUrl || null,
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
 * Manual sync orders from Shopify to Google Sheets
 */
export async function manualSync(req, res) {
  try {
    const {storeId, limit} = req.body;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    // Get sync configuration
    const syncConfig = await orderSyncRepo.getActiveSyncConfig(storeId);
    if (!syncConfig) {
      return res.status(404).json({
        success: false,
        error: 'No active sync configuration found for this store'
      });
    }

    // Get store and sheet
    const [store, sheet] = await Promise.all([
      storeRepo.getById(storeId),
      sheetRepo.getById(syncConfig.sheetId)
    ]);

    // Fetch orders from Shopify
    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    const orders = await shopifyService.getOrders({
      limit: limit || 50,
      status: 'any'
    });

    // Format orders for sheets
    const formattedOrders = orders.map(formatOrderForSheet);

    // STEP 1: Save to Firestore first (always succeed, our backup)
    let savedToFirestore = 0;
    for (const formattedOrder of formattedOrders) {
      try {
        await orderRepo.saveOrder({
          ...formattedOrder,
          storeId: store.id,
          syncConfigId: syncConfig.id
        });
        savedToFirestore++;
      } catch (error) {
        console.error('Error saving order to Firestore:', error);
      }
    }

    // STEP 2: Try to sync to Google Sheets
    let syncedToSheet = 0;
    let sheetError = null;
    try {
      const sheetsService = new GoogleSheetsService(sheet.credentials);
      await sheetsService.writeOrders(
        syncConfig.spreadsheetId,
        syncConfig.targetSheet,
        formattedOrders
      );
      syncedToSheet = formattedOrders.length;

      // Mark all as synced to sheet
      for (const formattedOrder of formattedOrders) {
        try {
          await orderRepo.markSyncedToSheet(store.id, formattedOrder.orderId);
        } catch (error) {
          console.error('Error marking order as synced:', error);
        }
      }
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      sheetError = error.message;

      // Orders are still in Firestore, can retry later
      for (const formattedOrder of formattedOrders) {
        try {
          await orderRepo.incrementSyncAttempt(store.id, formattedOrder.orderId, error.message);
        } catch (err) {
          console.error('Error incrementing sync attempt:', err);
        }
      }
    }

    // Update sync config
    await orderSyncRepo.updateSyncJob(syncConfig.id, {
      totalOrdersSynced: (syncConfig.totalOrdersSynced || 0) + syncedToSheet,
      lastSyncAt: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: sheetError
        ? `Saved ${savedToFirestore} orders to Firestore. Sheet sync failed: ${sheetError}`
        : `Synced ${syncedToSheet} orders successfully`,
      data: {
        savedToFirestore,
        syncedToSheet,
        totalSynced: (syncConfig.totalOrdersSynced || 0) + syncedToSheet,
        sheetError
      }
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
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
    const sheetsService = new GoogleSheetsService(sheet.credentials);

    let resynced = 0;
    let failed = 0;

    // Try to sync each order
    for (const order of failedOrders) {
      try {
        await sheetsService.appendOrder(
          syncConfig.spreadsheetId,
          syncConfig.targetSheet,
          order
        );

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
      // Get all stores for user and their configs
      const stores = await storeRepo.getByUser(userId);
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
 * Register webhook with Shopify
 */
export async function registerWebhook(req, res) {
  try {
    const {storeId, webhookUrl} = req.body;

    if (!storeId || !webhookUrl) {
      return res.status(400).json({
        success: false,
        error: 'storeId and webhookUrl are required'
      });
    }

    const store = await storeRepo.getById(storeId);
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Register orders/create webhook
    const createWebhook = await shopifyService.createWebhook({
      topic: 'orders/create',
      address: webhookUrl,
      format: 'json'
    });

    // Register orders/updated webhook
    const updateWebhook = await shopifyService.createWebhook({
      topic: 'orders/updated',
      address: webhookUrl,
      format: 'json'
    });

    // Save webhook registrations
    await Promise.all([
      orderSyncRepo.registerWebhook({
        storeId,
        shopDomain: store.shopDomain,
        shopifyWebhookId: createWebhook.id,
        topic: 'orders/create',
        address: webhookUrl
      }),
      orderSyncRepo.registerWebhook({
        storeId,
        shopDomain: store.shopDomain,
        shopifyWebhookId: updateWebhook.id,
        topic: 'orders/updated',
        address: webhookUrl
      })
    ]);

    return res.json({
      success: true,
      message: 'Webhooks registered successfully',
      data: {
        webhooks: [createWebhook, updateWebhook]
      }
    });
  } catch (error) {
    console.error('Register webhook error:', error);
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
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const hmac = req.get('X-Shopify-Hmac-SHA256');
    const topic = req.get('X-Shopify-Topic');
    const order = req.body;

    // Verify webhook authenticity
    const store = await storeRepo.getByShopDomain(shopDomain);
    if (!store) {
      console.error('Store not found for webhook:', shopDomain);
      return res.status(404).json({error: 'Store not found'});
    }

    // Verify HMAC
    const isValid = verifyWebhookHmac(req.rawBody, hmac, store.accessToken);
    if (!isValid) {
      console.error('Invalid webhook HMAC');
      return res.status(401).json({error: 'Invalid webhook signature'});
    }

    // Get active sync configuration
    const syncConfig = await orderSyncRepo.getActiveSyncConfig(store.id);
    if (!syncConfig) {
      console.log('No active sync config for store:', store.id);
      return res.status(200).json({message: 'No sync config, skipping'});
    }

    // Check if order was already synced (prevent duplicates)
    const alreadySynced = await orderSyncRepo.isOrderSynced(store.id, order.id.toString());
    if (alreadySynced && topic === 'orders/create') {
      console.log('Order already synced:', order.id);
      return res.status(200).json({message: 'Already synced'});
    }

    // Format order for sheet
    const formattedOrder = formatOrderForSheet(order);

    // STEP 1: Save to Firestore first (always succeed, our backup)
    try {
      await orderRepo.saveOrder({
        ...formattedOrder,
        storeId: store.id,
        syncConfigId: syncConfig.id
      });
    } catch (error) {
      console.error('Error saving order to Firestore:', error);
      // Continue anyway - will try to sync to sheet
    }

    // STEP 2: Try to sync to Google Sheets
    let syncedToSheet = false;
    try {
      const sheet = await sheetRepo.getById(syncConfig.sheetId);
      const sheetsService = new GoogleSheetsService(sheet.credentials);

      if (topic === 'orders/create') {
        // Append new order
        await sheetsService.appendOrder(
          syncConfig.spreadsheetId,
          syncConfig.targetSheet,
          formattedOrder
        );

        // Track synced order
        await orderSyncRepo.trackSyncedOrder({
          storeId: store.id,
          shopifyOrderId: order.id.toString(),
          orderNumber: order.name
        });
      } else if (topic === 'orders/updated') {
        // Update existing order
        await sheetsService.updateOrder(
          syncConfig.spreadsheetId,
          syncConfig.targetSheet,
          order.name,
          formattedOrder
        );
      }

      syncedToSheet = true;

      // Mark as synced in Firestore
      await orderRepo.markSyncedToSheet(store.id, formattedOrder.orderId);

      // Update sync stats
      await orderSyncRepo.updateSyncJob(syncConfig.id, {
        totalOrdersSynced: (syncConfig.totalOrdersSynced || 0) + 1,
        lastSyncAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);

      // Increment sync attempt counter
      await orderRepo.incrementSyncAttempt(
        store.id,
        formattedOrder.orderId,
        error.message
      );

      // Still return success since we saved to Firestore
      return res.status(200).json({
        success: true,
        message: 'Order saved to Firestore, sheet sync failed',
        savedToFirestore: true,
        syncedToSheet: false
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order synced',
      savedToFirestore: true,
      syncedToSheet
    });
  } catch (error) {
    console.error('Handle order webhook error:', error);
    return res.status(500).json({error: error.message});
  }
}

/**
 * Get webhook setup instructions
 */
export async function getWebhookInstructions(req, res) {
  try {
    const {storeId} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const store = await storeRepo.getById(storeId);
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    // Get registered webhooks
    const webhooks = await orderSyncRepo.getWebhooksByStore(storeId);

    const instructions = {
      webhookUrl: `${process.env.FUNCTION_URL || 'https://your-function-url'}/api/orders/webhook`,
      shopDomain: store.shopDomain,
      registeredWebhooks: webhooks,
      steps: [
        {
          step: 1,
          title: 'Go to Shopify Admin',
          description: `Navigate to ${store.shopDomain}.myshopify.com/admin/settings/notifications`
        },
        {
          step: 2,
          title: 'Create Webhook',
          description: 'Click "Create webhook" button'
        },
        {
          step: 3,
          title: 'Configure Webhook',
          details: {
            event: 'Order creation',
            format: 'JSON',
            url: `${process.env.FUNCTION_URL || 'https://your-function-url'}/api/orders/webhook`,
            version: 'Latest'
          }
        },
        {
          step: 4,
          title: 'Repeat for Order Updates',
          description: 'Create another webhook with event "Order update" using the same URL'
        },
        {
          step: 5,
          title: 'Verify',
          description: 'Create a test order in your Shopify store to verify the sync'
        }
      ],
      notes: [
        'All stores send to the same webhook URL',
        'System identifies store by shop domain in webhook headers',
        'HMAC signature is verified for security',
        'Orders are synced in real-time when created or updated'
      ]
    };

    return res.json({
      success: true,
      data: instructions
    });
  } catch (error) {
    console.error('Get webhook instructions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Format order data for Google Sheets with customer information
 */
function formatOrderForSheet(order) {
  const customer = order.customer || {};
  const shippingAddress = order.shipping_address || {};
  const billingAddress = order.billing_address || {};

  return {
    // Order Info
    orderNumber: order.name || '',
    orderId: order.id || '',
    orderDate: order.created_at || '',
    orderStatus: order.financial_status || '',
    fulfillmentStatus: order.fulfillment_status || '',
    totalPrice: order.total_price || '0',
    currency: order.currency || 'USD',
    paymentMethod: order.payment_gateway_names?.join(', ') || '',

    // Customer Info
    customerId: customer.id || '',
    customerEmail: customer.email || '',
    customerPhone: customer.phone || '',
    customerFirstName: customer.first_name || '',
    customerLastName: customer.last_name || '',
    customerFullName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),

    // Shipping Address
    shippingName: shippingAddress.name || '',
    shippingAddress1: shippingAddress.address1 || '',
    shippingAddress2: shippingAddress.address2 || '',
    shippingCity: shippingAddress.city || '',
    shippingProvince: shippingAddress.province || '',
    shippingZip: shippingAddress.zip || '',
    shippingCountry: shippingAddress.country || '',
    shippingPhone: shippingAddress.phone || '',

    // Billing Address
    billingName: billingAddress.name || '',
    billingAddress1: billingAddress.address1 || '',
    billingCity: billingAddress.city || '',
    billingProvince: billingAddress.province || '',
    billingZip: billingAddress.zip || '',
    billingCountry: billingAddress.country || '',

    // Line Items
    itemsCount: order.line_items?.length || 0,
    items: order.line_items
      ?.map(item => `${item.name} (x${item.quantity})`)
      .join(', ') || '',

    // Tracking
    trackingNumbers: order.fulfillments
      ?.map(f => f.tracking_number)
      .filter(Boolean)
      .join(', ') || '',
    trackingUrls: order.fulfillments
      ?.map(f => f.tracking_url)
      .filter(Boolean)
      .join(', ') || '',

    // Notes
    note: order.note || '',
    tags: order.tags || '',

    // Timestamps
    createdAt: order.created_at || '',
    updatedAt: order.updated_at || ''
  };
}

/**
 * Verify webhook HMAC signature
 */
function verifyWebhookHmac(data, hmac, secret) {
  const hash = crypto.createHmac('sha256', secret).update(data).digest('base64');
  return hash === hmac;
}
