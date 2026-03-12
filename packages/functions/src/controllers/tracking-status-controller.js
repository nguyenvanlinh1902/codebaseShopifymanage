import {PubSub} from '@google-cloud/pubsub';
import {getFirestore} from 'firebase-admin/firestore';
import {TrackingApiKeyRepository} from '../repositories/tracking-api-key-repository.js';
import {TrackingStatusRepository, FINAL_STATUSES} from '../repositories/tracking-status-repository.js';
import {SeventeenTrackService} from '../services/seventeen-track-service.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';

const apiKeyRepo = new TrackingApiKeyRepository();
const statusRepo = new TrackingStatusRepository();
const trackService = new SeventeenTrackService(apiKeyRepo);
const storeRepo = new StoreRepository();
const pubsub = new PubSub();

const TOPIC_CHECK_STORE_TRACKING = 'check-store-tracking';

/**
 * Cron handler: full tracking status update cycle
 * Step 1: Reset monthly quotas
 * Step 2: Register unregistered trackings
 * Step 3: Get active trackings
 * Step 4: Query 17TRACK for statuses (auto-registers rejected ones)
 * Step 5: Bulk upsert results to Firestore
 */
export async function processTrackingStatusQueue() {
  console.log('[TrackingStatus] Starting tracking status update cycle');

  // Step 1: Reset monthly quotas
  const resetCount = await apiKeyRepo.resetMonthlyQuotas();
  if (resetCount > 0) console.log(`[TrackingStatus] Reset quotas for ${resetCount} keys`);

  // Step 2: Register unregistered trackings
  const unregistered = await statusRepo.getUnregistered(2000);
  let registeredCount = 0;
  if (unregistered.length > 0) {
    const numbers = unregistered.map(t => t.trackingNumber);
    try {
      await trackService.registerTrackings(numbers);
      registeredCount = numbers.length;
      console.log(`[TrackingStatus] Registered ${registeredCount} trackings`);
    } catch (err) {
      console.error('[TrackingStatus] Registration error:', err.message);
    }
  }

  // Step 3: Get active (non-delivered) trackings
  const activeTrackings = await statusRepo.getActiveTrackings(2000);
  console.log(`[TrackingStatus] Found ${activeTrackings.length} active trackings to query`);

  if (!activeTrackings.length) {
    console.log('[TrackingStatus] No active trackings, skipping query');
    return {registered: registeredCount, queried: 0, updated: 0};
  }

  // Step 4: Query 17TRACK for statuses
  const activeNumbers = activeTrackings.map(t => t.trackingNumber);
  let trackResults = [];
  try {
    const queryResult = await trackService.getTrackInfo(activeNumbers);
    trackResults = queryResult.results;

    // Auto-register rejected trackings that need registration, then re-query
    const needsRegister = (queryResult.rejected || [])
      .filter(r => r.error?.includes('does not register'))
      .map(r => r.number);

    if (needsRegister.length > 0) {
      console.log(`[TrackingStatus] Auto-registering ${needsRegister.length} unregistered trackings`);
      const regResult = await trackService.registerTrackings(needsRegister);
      if (regResult.accepted?.length) {
        console.log(`[TrackingStatus] Re-registered ${regResult.accepted.length}, re-querying...`);
        const reQuery = await trackService.getTrackInfo(regResult.accepted);
        trackResults.push(...reQuery.results);
        registeredCount += regResult.accepted.length;
      }
      if (regResult.error) {
        console.warn(`[TrackingStatus] Auto-register error:`, regResult.error);
      }
    }

    const otherRejected = (queryResult.rejected || []).filter(r => !r.error?.includes('does not register'));
    if (otherRejected.length) {
      console.warn(`[TrackingStatus] Query rejected ${otherRejected.length}:`, JSON.stringify(otherRejected));
    }
    console.log(`[TrackingStatus] Query results: ${trackResults.length} accepted, ${queryResult.rejected?.length || 0} rejected`);
  } catch (err) {
    console.error('[TrackingStatus] Query error:', err.message);
  }

  // Step 5: Bulk upsert results to Firestore
  let updatedCount = 0;
  if (trackResults.length > 0) {
    const now = new Date().toISOString();
    const statusUpdates = trackResults.map(result => ({
      trackingNumber: result.trackingNumber,
      carrier: result.carrier || '',
      carrierCode: result.carrierCode || 0,
      status: result.status || 'pending',
      statusCode: result.statusCode || 0,
      lastEvent: result.lastEvent || '',
      lastEventDate: result.lastEventDate || '',
      isRegistered: true,
      isDelivered: FINAL_STATUSES.includes(result.status),
      lastCheckedAt: now
    }));

    updatedCount = await statusRepo.bulkUpsert(statusUpdates);
    console.log(`[TrackingStatus] Upserted ${updatedCount} status records`);
  }

  const summary = {
    registered: registeredCount,
    queried: activeNumbers.length,
    updated: updatedCount
  };
  console.log('[TrackingStatus] Cycle complete:', summary);
  return summary;
}

// ============ API KEY HANDLERS ============

/** List all API keys (mask apiKey to last 4 chars) */
export async function listApiKeys(req, res) {
  try {
    const keys = await apiKeyRepo.getAll();
    const masked = keys.map(k => ({
      ...k,
      apiKey: k.apiKey ? `****${k.apiKey.slice(-4)}` : '****'
    }));
    res.json({success: true, data: masked});
  } catch (err) {
    console.error('[TrackingStatus] listApiKeys error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Sync quota from 17TRACK API for a specific key */
export async function syncKeyQuota(req, res) {
  try {
    const {id} = req.params;
    const keyRecord = await apiKeyRepo.getById(id);
    if (!keyRecord) return res.status(404).json({success: false, error: 'Key not found'});

    const quota = await trackService.getQuota(keyRecord.apiKey);
    await apiKeyRepo.update(id, {
      quotaTotal: quota.quotaTotal,
      quotaUsed: quota.quotaUsed,
      quotaRemain: quota.quotaRemain,
      todayUsed: quota.todayUsed,
      lastSyncedAt: new Date().toISOString()
    });

    res.json({success: true, data: quota});
  } catch (err) {
    console.error('[TrackingStatus] syncKeyQuota error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Create a new API key */
export async function createApiKey(req, res) {
  try {
    const {apiKey, name} = req.body;
    if (!apiKey || !name) {
      return res.status(400).json({success: false, error: 'apiKey and name are required'});
    }
    const record = await apiKeyRepo.create({
      apiKey,
      name,
      quotaTotal: req.body.quotaTotal || 100,
      quotaUsed: 0,
      status: 'active',
      errorCount: 0
    });
    res.status(201).json({success: true, data: {...record, apiKey: `****${apiKey.slice(-4)}`}});
  } catch (err) {
    console.error('[TrackingStatus] createApiKey error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Update an API key by id */
export async function updateApiKey(req, res) {
  try {
    const {id} = req.params;
    await apiKeyRepo.update(id, req.body);
    res.json({success: true});
  } catch (err) {
    console.error('[TrackingStatus] updateApiKey error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Delete an API key by id */
export async function deleteApiKey(req, res) {
  try {
    const {id} = req.params;
    await apiKeyRepo.delete(id);
    res.json({success: true});
  } catch (err) {
    console.error('[TrackingStatus] deleteApiKey error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

// ============ STATUS HANDLERS ============

/** List statuses with optional filters: storeId, storeIds, all, status, limit */
export async function listStatuses(req, res) {
  try {
    const {storeId, storeIds, all, status, limit = 100} = req.query;
    let records;

    if (all === 'true' || all === '1') {
      records = await statusRepo.getAll(parseInt(limit));
    } else if (storeId) {
      records = await statusRepo.getByStore(storeId, parseInt(limit));
    } else if (storeIds) {
      const ids = storeIds.split(',').filter(Boolean);
      const perStore = await Promise.all(ids.map(id => statusRepo.getByStore(id, parseInt(limit))));
      records = perStore.flat();
    } else {
      return res.json({success: true, data: [], total: 0});
    }

    if (status) records = records.filter(r => r.status === status);
    res.json({success: true, data: records, total: records.length});
  } catch (err) {
    console.error('[TrackingStatus] listStatuses error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Get status by tracking number */
export async function getStatus(req, res) {
  try {
    const {trackingNumber} = req.params;
    const record = await statusRepo.getByTrackingNumber(trackingNumber);
    if (!record) {
      return res.status(404).json({success: false, error: 'Tracking not found'});
    }
    res.json({success: true, data: record});
  } catch (err) {
    console.error('[TrackingStatus] getStatus error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Manual trigger: run the full status check cycle */
export async function triggerStatusCheck(req, res) {
  try {
    const summary = await processTrackingStatusQueue();
    res.json({success: true, data: summary});
  } catch (err) {
    console.error('[TrackingStatus] triggerStatusCheck error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Dashboard stats: combined API key + status stats */
export async function getDashboardStats(req, res) {
  try {
    const [keyStats, statusStats] = await Promise.all([
      apiKeyRepo.getStats(),
      statusRepo.getStats()
    ]);
    res.json({success: true, data: {apiKeys: keyStats, statuses: statusStats}});
  } catch (err) {
    console.error('[TrackingStatus] getDashboardStats error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

// ============ CHECK ORDERS ============

/**
 * Fetch fulfilled orders from Shopify for display.
 * GET /api/tracking-status/orders?storeId=xxx (optional, all stores if omitted)
 * Returns orders with tracking info + whether each tracking is already in history.
 */
export async function fetchOrders(req, res) {
  try {
    const {storeId, storeIds} = req.query;
    let stores;

    if (storeId) {
      const store = await storeRepo.getById(storeId);
      stores = store && store.accessToken ? [store] : [];
    } else if (storeIds) {
      const ids = storeIds.split(',').filter(Boolean);
      const fetched = await Promise.all(ids.map(id => storeRepo.getById(id)));
      stores = fetched.filter(s => s && s.accessToken && s.shopDomain);
    } else {
      return res.json({success: true, data: {orders: [], total: 0}});
    }

    if (!stores.length) {
      return res.json({success: true, data: {orders: [], total: 0}});
    }

    // Fetch orders from all stores in parallel
    const storeOrders = await Promise.all(
      stores.map(async store => {
        try {
          const shopifyService = new ShopifyService(store);
          const orders = await shopifyService.getOrdersWithFulfillments();
          return orders.map(order => ({
            ...order,
            storeDomain: store.shopDomain,
            storeId: store.id
          }));
        } catch (err) {
          console.error(`[FetchOrders] ${store.shopDomain} error:`, err.message);
          return [];
        }
      })
    );

    const allOrders = storeOrders.flat();

    // Extract tracking numbers and check history
    const trackingNumbers = new Set();
    for (const order of allOrders) {
      for (const f of order.fulfillments || []) {
        for (const t of f.trackingInfo || []) {
          if (t.number) trackingNumbers.add(t.number);
        }
      }
    }

    // Check which trackings already exist in history
    const existingMap = {};
    const numbers = [...trackingNumbers];
    for (let i = 0; i < numbers.length; i += 30) {
      const chunk = numbers.slice(i, i + 30);
      const existing = await statusRepo.getByTrackingNumbers(chunk);
      existing.forEach(r => {
        existingMap[r.trackingNumber] = r;
      });
    }

    // Format response: flat list of order + tracking rows
    const rows = [];
    for (const order of allOrders) {
      for (const f of order.fulfillments || []) {
        for (const t of f.trackingInfo || []) {
          if (!t.number) continue;
          const history = existingMap[t.number];
          rows.push({
            orderId: order.id,
            orderNumber: order.name,
            orderDate: order.createdAt,
            fulfillmentStatus: order.displayFulfillmentStatus,
            storeDomain: order.storeDomain,
            storeId: order.storeId,
            trackingNumber: t.number,
            carrier: t.company || '',
            trackingUrl: t.url || '',
            // History info (null if first time)
            inHistory: !!history,
            status: history?.status || null,
            lastEvent: history?.lastEvent || null,
            lastCheckedAt: history?.lastCheckedAt || null,
            isDelivered: history?.isDelivered || false,
            apiKeyName: history?.apiKeyName || ''
          });
        }
      }
    }

    res.json({success: true, data: {orders: rows, total: rows.length}});
  } catch (err) {
    console.error('[TrackingStatus] fetchOrders error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/**
 * Check orders: create job doc + publish PubSub per store (like Import Product).
 * POST /api/tracking-status/check-orders { storeId?: string, storeIds?: string[] }
 * Returns jobId immediately. Frontend watches job doc via Firestore onSnapshot.
 */
export async function checkOrders(req, res) {
  try {
    const {storeId, storeIds} = req.body;
    let targetStores;

    if (storeId) {
      const store = await storeRepo.getById(storeId);
      targetStores = store && store.accessToken ? [store] : [];
    } else if (storeIds && Array.isArray(storeIds) && storeIds.length > 0) {
      const fetched = await Promise.all(storeIds.map(id => storeRepo.getById(id)));
      targetStores = fetched.filter(s => s && s.accessToken && s.shopDomain);
    } else {
      return res.json({success: true, data: {queued: 0}});
    }

    if (!targetStores.length) {
      return res.json({success: true, data: {queued: 0}});
    }

    // Create job document in Firestore for progress tracking
    const db = getFirestore();
    const jobRef = db.collection('tracking_check_jobs').doc();
    const storeList = targetStores.map(s => ({
      storeId: s.id,
      storeName: s.name || s.shopDomain,
      status: 'pending'
    }));
    await jobRef.set({
      id: jobRef.id,
      status: 'processing',
      totalStores: targetStores.length,
      processedStores: 0,
      totalRegistered: 0,
      totalQueried: 0,
      totalUpdated: 0,
      stores: storeList,
      createdAt: new Date().toISOString()
    });

    // Publish PubSub message per store (background processing)
    const topic = pubsub.topic(TOPIC_CHECK_STORE_TRACKING);
    const [exists] = await topic.exists();
    if (!exists) await topic.create();

    await Promise.all(
      targetStores.map(store =>
        topic.publishMessage({
          json: {
            storeId: store.id,
            shopDomain: store.shopDomain,
            jobId: jobRef.id
          }
        })
      )
    );

    res.json({
      success: true,
      data: {
        jobId: jobRef.id,
        queued: targetStores.length,
        stores: targetStores.map(s => s.name || s.shopDomain)
      }
    });
  } catch (err) {
    console.error('[TrackingStatus] checkOrders error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/**
 * Check a single tracking number via 17TRACK.
 * POST /api/tracking-status/check-single { trackingNumber, carrier, orderNumber, storeId }
 * Registers if new, queries status, upserts result.
 */
export async function checkSingleTracking(req, res) {
  try {
    const {trackingNumber, carrier, orderNumber, storeId} = req.body;
    if (!trackingNumber) {
      return res.status(400).json({success: false, error: 'trackingNumber is required'});
    }

    // Check if already in history
    const existing = await statusRepo.getByTrackingNumber(trackingNumber);
    const isNew = !existing;
    let usedKeyName = null;
    const warnings = [];

    // Register if new (costs quota)
    if (isNew) {
      const regResult = await trackService.registerTrackings([trackingNumber]);
      if (regResult.usedKeys?.length) usedKeyName = regResult.usedKeys[0].name;
      if (regResult.rejected?.length > 0) {
        warnings.push(`Register rejected: ${regResult.rejected.join(', ')}`);
      }
      if (regResult.error) {
        warnings.push(`Register: ${regResult.error}`);
      }
    }

    // Query status (free)
    let result = null;
    let queryResult = await trackService.getTrackInfo([trackingNumber]);
    result = queryResult.results[0] || null;
    if (queryResult.usedKeys?.length) usedKeyName = queryResult.usedKeys[0].name;

    // Auto-register if rejected with "does not register" then retry query
    const needsRegister = queryResult.rejected?.some(r => r.error?.includes('does not register'));
    if (!result && needsRegister) {
      console.log(`[CheckSingle] ${trackingNumber} not registered, auto-registering...`);
      const regResult = await trackService.registerTrackings([trackingNumber]);
      if (regResult.usedKeys?.length) usedKeyName = regResult.usedKeys[0].name;
      if (regResult.error) {
        warnings.push(`Auto-register: ${regResult.error}`);
      } else {
        // Re-query after registration
        queryResult = await trackService.getTrackInfo([trackingNumber]);
        result = queryResult.results[0] || null;
        if (queryResult.usedKeys?.length) usedKeyName = queryResult.usedKeys[0].name;
      }
    }

    if (queryResult.error) {
      warnings.push(`Query: ${queryResult.error}`);
    }
    if (!result) {
      warnings.push('17TRACK returned no data for this tracking number');
    }

    const now = new Date().toISOString();
    const record = {
      trackingNumber,
      orderNumber: orderNumber || existing?.orderNumber || '',
      storeId: storeId || existing?.storeId || '',
      carrier: result?.carrier || carrier || existing?.carrier || '',
      carrierCode: result?.carrierCode || 0,
      status: result?.status || 'pending',
      statusCode: result?.statusCode || 0,
      lastEvent: result?.lastEvent || '',
      lastEventDate: result?.lastEventDate || '',
      isRegistered: true,
      isDelivered: FINAL_STATUSES.includes(result?.status),
      lastCheckedAt: now,
      apiKeyName: usedKeyName || existing?.apiKeyName || ''
    };

    await statusRepo.bulkUpsert([record]);

    res.json({
      success: true,
      data: record,
      isNew,
      warnings: warnings.length > 0 ? warnings : undefined
    });
  } catch (err) {
    console.error('[TrackingStatus] checkSingleTracking error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/**
 * PubSub handler: process one store's fulfilled orders.
 * Updates job document in Firestore for real-time progress (like Import Product).
 */
export async function processStoreTracking(message) {
  const data = message.json || JSON.parse(Buffer.from(message.data, 'base64').toString());
  const {storeId, shopDomain, jobId} = data;
  console.log(`[CheckStoreTracking] Processing store: ${shopDomain} (${storeId})`);

  const db = getFirestore();
  let registeredCount = 0;
  let queriedCount = 0;
  let updatedCount = 0;

  try {
    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      console.warn(`[CheckStoreTracking] Store ${storeId} missing credentials`);
      await updateJobStoreStatus(db, jobId, storeId, 'skipped');
      return;
    }

    // Step 1: Fetch fulfilled orders via GraphQL
    const shopifyService = new ShopifyService(store);
    const orders = await shopifyService.getOrdersWithFulfillments();
    console.log(`[CheckStoreTracking] ${shopDomain}: ${orders.length} fulfilled orders`);

    if (!orders.length) {
      await updateJobStoreStatus(db, jobId, storeId, 'done');
      return;
    }

    // Step 2: Extract unique tracking numbers
    const trackingMap = new Map();
    for (const order of orders) {
      for (const fulfillment of order.fulfillments || []) {
        for (const info of fulfillment.trackingInfo || []) {
          if (info.number && !trackingMap.has(info.number)) {
            trackingMap.set(info.number, {
              trackingNumber: info.number,
              carrier: info.company || '',
              orderNumber: order.name,
              storeId
            });
          }
        }
      }
    }

    const allTrackings = [...trackingMap.values()];
    if (!allTrackings.length) {
      await updateJobStoreStatus(db, jobId, storeId, 'done');
      return;
    }

    // Step 3: Compare with existing history
    const existingNumbers = new Set();
    const numbers = allTrackings.map(t => t.trackingNumber);
    for (let i = 0; i < numbers.length; i += 30) {
      const chunk = numbers.slice(i, i + 30);
      const existing = await statusRepo.getByTrackingNumbers(chunk);
      existing.forEach(r => existingNumbers.add(r.trackingNumber));
    }

    const newTrackings = allTrackings.filter(t => !existingNumbers.has(t.trackingNumber));

    // Step 4: Register new trackings (costs quota only on success)
    if (newTrackings.length > 0) {
      try {
        const regResult = await trackService.registerTrackings(
          newTrackings.map(t => t.trackingNumber)
        );
        registeredCount = regResult.accepted?.length || 0;
      } catch (err) {
        console.error(`[CheckStoreTracking] ${shopDomain}: register error:`, err.message);
      }

      const newRecords = newTrackings.map(t => ({
        ...t,
        status: 'pending',
        statusCode: 0,
        isRegistered: true,
        isDelivered: false,
        lastCheckedAt: new Date().toISOString()
      }));
      await statusRepo.bulkUpsert(newRecords);
    }

    // Step 5: Query all trackings for status (free)
    const allNumbers = allTrackings.map(t => t.trackingNumber);
    queriedCount = allNumbers.length;
    let trackResults = [];
    let queryKeyName = '';
    try {
      const queryResult = await trackService.getTrackInfo(allNumbers);
      trackResults = queryResult.results;
      if (queryResult.usedKeys?.length) queryKeyName = queryResult.usedKeys[0].name;

      // Auto-register rejected "does not register" trackings
      const needsRegister = (queryResult.rejected || [])
        .filter(r => r.error?.includes('does not register'))
        .map(r => r.number);
      if (needsRegister.length > 0) {
        const regResult = await trackService.registerTrackings(needsRegister);
        if (regResult.accepted?.length) {
          const reQuery = await trackService.getTrackInfo(regResult.accepted);
          trackResults.push(...reQuery.results);
          registeredCount += regResult.accepted.length;
        }
      }
    } catch (err) {
      console.error(`[CheckStoreTracking] ${shopDomain}: query error:`, err.message);
    }

    // Step 6: Upsert results
    if (trackResults.length > 0) {
      const now = new Date().toISOString();
      const statusUpdates = trackResults.map(result => {
        const meta = trackingMap.get(result.trackingNumber) || {};
        return {
          trackingNumber: result.trackingNumber,
          orderNumber: meta.orderNumber || '',
          storeId,
          carrier: result.carrier || meta.carrier || '',
          carrierCode: result.carrierCode || 0,
          status: result.status || 'pending',
          statusCode: result.statusCode || 0,
          lastEvent: result.lastEvent || '',
          lastEventDate: result.lastEventDate || '',
          isRegistered: true,
          isDelivered: FINAL_STATUSES.includes(result.status),
          lastCheckedAt: now,
          apiKeyName: queryKeyName
        };
      });
      updatedCount = await statusRepo.bulkUpsert(statusUpdates);
    }

    console.log(
      `[CheckStoreTracking] ${shopDomain}: done. reg=${registeredCount} q=${queriedCount} upd=${updatedCount}`
    );
    await updateJobStoreStatus(db, jobId, storeId, 'done', {
      registered: registeredCount,
      queried: queriedCount,
      updated: updatedCount
    });
  } catch (err) {
    console.error(`[CheckStoreTracking] ${shopDomain} error:`, err.message);
    await updateJobStoreStatus(db, jobId, storeId, 'error', {
      registered: registeredCount,
      queried: queriedCount,
      updated: updatedCount,
      error: err.message
    });
    throw err;
  }
}

/**
 * Update job document with per-store progress.
 * Frontend watches this doc via Firestore onSnapshot for real-time progress.
 */
async function updateJobStoreStatus(db, jobId, storeId, status, counts = {}) {
  if (!jobId) return;
  try {
    const jobRef = db.collection('tracking_check_jobs').doc(jobId);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) return;

    const job = jobDoc.data();
    const stores = (job.stores || []).map(s => {
      if (s.storeId !== storeId) return s;
      return {
        ...s,
        status,
        registered: counts.registered || 0,
        queried: counts.queried || 0,
        updated: counts.updated || 0,
        error: counts.error || null
      };
    });
    const processedStores = stores.filter(s => s.status !== 'pending').length;
    const totalRegistered = stores.reduce((sum, s) => sum + (s.registered || 0), 0);
    const totalQueried = stores.reduce((sum, s) => sum + (s.queried || 0), 0);
    const totalUpdated = stores.reduce((sum, s) => sum + (s.updated || 0), 0);
    const allDone = processedStores >= job.totalStores;

    await jobRef.update({
      stores,
      processedStores,
      totalRegistered,
      totalQueried,
      totalUpdated,
      status: allDone ? 'completed' : 'processing',
      ...(allDone ? {completedAt: new Date().toISOString()} : {})
    });
  } catch (err) {
    console.error(`[UpdateJobStatus] jobId=${jobId} error:`, err.message);
  }
}
