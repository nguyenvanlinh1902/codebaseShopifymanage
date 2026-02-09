import {getFirestore} from 'firebase-admin/firestore';
import {StoreRepository} from '../repositories/storeRepository.js';
import {verifyWebhookHmac} from './shopifyInstallController.js';

const storeRepo = new StoreRepository();

/**
 * Verify incoming Shopify webhook and extract store info
 */
async function verifyAndGetStore(req) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const shopDomain = (req.get('X-Shopify-Shop-Domain') || '')
    .replace(/^https?:\/\//, '')
    .replace(/\.myshopify\.com.*$/, '')
    .trim()
    .toLowerCase();

  if (!shopDomain) return {error: 'Missing shop domain', status: 400};

  if (!verifyWebhookHmac(rawBody, hmacHeader)) {
    return {error: 'HMAC verification failed', status: 401};
  }

  const store = await storeRepo.getByShopDomain(shopDomain);
  return {store, shopDomain};
}

/**
 * Save webhook event to Firestore
 */
async function saveWebhookEvent(collection, shopDomain, topic, data) {
  const db = getFirestore();
  await db.collection('webhook_events').add({
    collection,
    shopDomain,
    topic,
    data,
    processedAt: new Date().toISOString()
  });
}

/**
 * POST /api/products/webhook
 */
export async function handleProductWebhook(req, res) {
  try {
    const topic = req.get('X-Shopify-Topic');
    const result = await verifyAndGetStore(req);

    if (result.error) {
      return res.status(result.status).json({success: false, error: result.error});
    }

    const {store, shopDomain} = result;
    const product = req.body;

    console.log(`[Webhook] ${topic} from ${shopDomain}: product ${product.id}`);

    const db = getFirestore();
    const productRef = db.collection('shopify_product_events');

    if (topic === 'products/delete') {
      await productRef.add({
        shopDomain,
        storeId: store?.id || null,
        shopifyProductId: product.id?.toString(),
        event: 'deleted',
        deletedAt: new Date().toISOString()
      });
    } else {
      await productRef.add({
        shopDomain,
        storeId: store?.id || null,
        shopifyProductId: product.id?.toString(),
        title: product.title || '',
        vendor: product.vendor || '',
        productType: product.product_type || '',
        status: product.status || '',
        tags: product.tags || '',
        variantsCount: product.variants?.length || 0,
        event: topic === 'products/create' ? 'created' : 'updated',
        rawData: product,
        receivedAt: new Date().toISOString()
      });
    }

    await saveWebhookEvent('products', shopDomain, topic, {productId: product.id});
    return res.status(200).json({success: true});
  } catch (error) {
    console.error('Product webhook error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/fulfillments/webhook
 */
export async function handleFulfillmentWebhook(req, res) {
  try {
    const topic = req.get('X-Shopify-Topic');
    const result = await verifyAndGetStore(req);

    if (result.error) {
      return res.status(result.status).json({success: false, error: result.error});
    }

    const {store, shopDomain} = result;
    const fulfillment = req.body;

    console.log(`[Webhook] ${topic} from ${shopDomain}: fulfillment ${fulfillment.id}`);

    const db = getFirestore();
    await db.collection('shopify_fulfillment_events').add({
      shopDomain,
      storeId: store?.id || null,
      shopifyFulfillmentId: fulfillment.id?.toString(),
      orderId: fulfillment.order_id?.toString(),
      status: fulfillment.status || '',
      trackingNumber: fulfillment.tracking_number || '',
      trackingUrl: fulfillment.tracking_url || '',
      trackingCompany: fulfillment.tracking_company || '',
      lineItemsCount: fulfillment.line_items?.length || 0,
      event: topic === 'fulfillments/create' ? 'created' : 'updated',
      rawData: fulfillment,
      receivedAt: new Date().toISOString()
    });

    await saveWebhookEvent('fulfillments', shopDomain, topic, {fulfillmentId: fulfillment.id});
    return res.status(200).json({success: true});
  } catch (error) {
    console.error('Fulfillment webhook error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/customers/webhook
 */
export async function handleCustomerWebhook(req, res) {
  try {
    const topic = req.get('X-Shopify-Topic');
    const result = await verifyAndGetStore(req);

    if (result.error) {
      return res.status(result.status).json({success: false, error: result.error});
    }

    const {store, shopDomain} = result;
    const customer = req.body;

    console.log(`[Webhook] ${topic} from ${shopDomain}: customer ${customer.id}`);

    const db = getFirestore();
    await db.collection('shopify_customer_events').add({
      shopDomain,
      storeId: store?.id || null,
      shopifyCustomerId: customer.id?.toString(),
      email: customer.email || '',
      firstName: customer.first_name || '',
      lastName: customer.last_name || '',
      phone: customer.phone || '',
      ordersCount: customer.orders_count || 0,
      totalSpent: customer.total_spent || '0',
      tags: customer.tags || '',
      event: topic === 'customers/create' ? 'created' : 'updated',
      rawData: customer,
      receivedAt: new Date().toISOString()
    });

    await saveWebhookEvent('customers', shopDomain, topic, {customerId: customer.id});
    return res.status(200).json({success: true});
  } catch (error) {
    console.error('Customer webhook error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/inventory/webhook
 */
export async function handleInventoryWebhook(req, res) {
  try {
    const topic = req.get('X-Shopify-Topic');
    const result = await verifyAndGetStore(req);

    if (result.error) {
      return res.status(result.status).json({success: false, error: result.error});
    }

    const {store, shopDomain} = result;
    const inventory = req.body;

    console.log(`[Webhook] ${topic} from ${shopDomain}: inventory_item ${inventory.inventory_item_id}`);

    const db = getFirestore();
    await db.collection('shopify_inventory_events').add({
      shopDomain,
      storeId: store?.id || null,
      inventoryItemId: inventory.inventory_item_id?.toString(),
      locationId: inventory.location_id?.toString(),
      available: inventory.available,
      rawData: inventory,
      receivedAt: new Date().toISOString()
    });

    await saveWebhookEvent('inventory', shopDomain, topic, {inventoryItemId: inventory.inventory_item_id});
    return res.status(200).json({success: true});
  } catch (error) {
    console.error('Inventory webhook error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/themes/webhook
 */
export async function handleThemeWebhook(req, res) {
  try {
    const topic = req.get('X-Shopify-Topic');
    const result = await verifyAndGetStore(req);

    if (result.error) {
      return res.status(result.status).json({success: false, error: result.error});
    }

    const {store, shopDomain} = result;
    const theme = req.body;

    console.log(`[Webhook] ${topic} from ${shopDomain}: theme ${theme.id}`);

    const db = getFirestore();
    await db.collection('shopify_theme_events').add({
      shopDomain,
      storeId: store?.id || null,
      shopifyThemeId: theme.id?.toString(),
      name: theme.name || '',
      role: theme.role || '',
      rawData: theme,
      receivedAt: new Date().toISOString()
    });

    await saveWebhookEvent('themes', shopDomain, topic, {themeId: theme.id});
    return res.status(200).json({success: true});
  } catch (error) {
    console.error('Theme webhook error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/shop/webhook
 */
export async function handleShopWebhook(req, res) {
  try {
    const topic = req.get('X-Shopify-Topic');
    const result = await verifyAndGetStore(req);

    if (result.error) {
      return res.status(result.status).json({success: false, error: result.error});
    }

    const {store, shopDomain} = result;
    const shopData = req.body;

    console.log(`[Webhook] ${topic} from ${shopDomain}`);

    if (store) {
      await storeRepo.update(store.id, {
        name: shopData.name || store.name,
        email: shopData.email || store.email,
        currency: shopData.currency || store.currency,
        timezone: shopData.timezone || store.timezone,
        planName: shopData.plan_display_name || store.planName,
        shopOwner: shopData.shop_owner || store.shopOwner,
        phone: shopData.phone || store.phone,
        country: shopData.country_name || store.country,
        lastShopUpdate: new Date().toISOString()
      });
    }

    await saveWebhookEvent('shop', shopDomain, topic, {shopId: shopData.id});
    return res.status(200).json({success: true});
  } catch (error) {
    console.error('Shop webhook error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
