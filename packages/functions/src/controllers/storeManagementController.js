import {StoreRepository} from '../repositories/storeRepository.js';
import {getFirestore} from 'firebase-admin/firestore';
import ShopifyService from '../services/shopifyService.js';

const storeRepo = new StoreRepository();
const getDb = () => getFirestore();

/**
 * Get full store details including Shopify live data
 */
export async function getStoreDetails(req, res) {
  try {
    const store = req.store;
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    const storeData = {
      id: store.id,
      shopDomain: store.shopDomain,
      name: store.name,
      email: store.email,
      phone: store.phone,
      currency: store.currency,
      timezone: store.timezone,
      plan: store.plan,
      country: store.country,
      status: store.status || 'active',
      installedAt: store.createdAt,
      settings: store.settings || {}
    };

    res.json({success: true, data: storeData});
  } catch (error) {
    console.error('[StoreManagement] getStoreDetails error:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Update store app-specific settings
 */
export async function updateStoreSettings(req, res) {
  try {
    const store = req.store;
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    const {syncFrequency, notifyOnSync, notifyOnError} = req.body;

    const settings = {
      ...(store.settings || {}),
      syncFrequency: syncFrequency || 'manual',
      notifyOnSync: Boolean(notifyOnSync),
      notifyOnError: notifyOnError !== false
    };

    await getDb().collection('shopify_stores').doc(store.id).update({
      settings,
      updatedAt: new Date().toISOString()
    });

    res.json({success: true, data: settings});
  } catch (error) {
    console.error('[StoreManagement] updateStoreSettings error:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Get store health status - check API access, webhook status
 */
export async function getStoreStatus(req, res) {
  try {
    const store = req.store;
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    const status = {
      connected: true,
      apiAccess: false,
      webhooksActive: false,
      lastSync: null
    };

    // Check API access by making a simple shop request
    if (store.accessToken) {
      try {
        const shopify = new ShopifyService(store.shopDomain, store.accessToken);
        await shopify.getShop();
        status.apiAccess = true;
      } catch {
        status.apiAccess = false;
      }
    }

    // Check webhook status
    const webhookEvents = await getDb()
      .collection('webhook_events')
      .where('shopDomain', '==', store.shopDomain)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!webhookEvents.empty) {
      status.webhooksActive = true;
      status.lastWebhook = webhookEvents.docs[0].data().createdAt;
    }

    // Check last sync
    const syncJobs = await getDb()
      .collection('order_sync_configs')
      .where('storeId', '==', store.id)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!syncJobs.empty) {
      status.lastSync = syncJobs.docs[0].data().lastSyncAt;
    }

    res.json({success: true, data: status});
  } catch (error) {
    console.error('[StoreManagement] getStoreStatus error:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Disconnect a store - revoke access and clean up
 */
export async function disconnectStore(req, res) {
  try {
    const store = req.store;
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    // Mark store as disconnected
    await getDb().collection('shopify_stores').doc(store.id).update({
      status: 'disconnected',
      accessToken: null,
      disconnectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`[StoreManagement] Store disconnected: ${store.shopDomain}`);
    res.json({success: true, message: 'Store disconnected successfully'});
  } catch (error) {
    console.error('[StoreManagement] disconnectStore error:', error);
    res.status(500).json({success: false, error: error.message});
  }
}
