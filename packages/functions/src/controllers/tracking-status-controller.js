import {PubSub} from '@google-cloud/pubsub';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {TrackingApiKeyRepository} from '../repositories/tracking-api-key-repository.js';
import {TrackingStatusRepository, FINAL_STATUSES} from '../repositories/tracking-status-repository.js';
import {SeventeenTrackService} from '../services/seventeen-track-service.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {paginateArray, parsePaginationParams} from '../utils/paginate-array.js';

const apiKeyRepo = new TrackingApiKeyRepository();
const statusRepo = new TrackingStatusRepository();
const trackService = new SeventeenTrackService(apiKeyRepo);
const storeRepo = new StoreRepository();
const pubsub = new PubSub();

const TOPIC_CHECK_STORE_TRACKING = 'check-store-tracking';
const TOPIC_RECHECK_TRACKING_GROUP = 'recheck-tracking-group';

/**
 * Cron/manual trigger: tạo job + publish PubSub per group (background processing).
 * Flow: reset quota → sync quota → phân nhóm → publish PubSub per group → return jobId.
 * Frontend watches job doc via Firestore onSnapshot.
 */
export async function processTrackingStatusQueue({statuses} = {}) {
  const label = statuses?.length
    ? `[TrackingStatus:${statuses.join(',')}]`
    : '[TrackingStatus]';
  console.log(`${label} Starting tracking status update cycle`);

  // Step 1: Reset monthly quotas
  const resetCount = await apiKeyRepo.resetMonthlyQuotas();
  if (resetCount > 0) console.log(`${label} Reset quotas for ${resetCount} keys`);

  // Step 2: Get trackings grouped by apiKeyId
  let groupedTrackings;
  if (statuses?.length) {
    const perStatus = await Promise.all(
      statuses.map(s => statusRepo.getByStatusGroupedByKey(s, 2000))
    );
    groupedTrackings = new Map();
    for (const map of perStatus) {
      for (const [keyId, tracks] of map) {
        if (!groupedTrackings.has(keyId)) groupedTrackings.set(keyId, []);
        groupedTrackings.get(keyId).push(...tracks);
      }
    }
  } else {
    groupedTrackings = await statusRepo.getActiveGroupedByKey(2000);
  }

  const totalCount = [...groupedTrackings.values()].reduce((s, arr) => s + arr.length, 0);
  console.log(`${label} Found ${totalCount} trackings in ${groupedTrackings.size} key groups`);

  if (!totalCount) {
    return {jobId: null, registered: 0, queried: 0, groups: 0};
  }

  // Step 3: Split keyed vs unkeyed
  const unkeyedTrackings = groupedTrackings.get('__none__') || [];
  groupedTrackings.delete('__none__');

  // Step 4: Sync quota + phân bổ unkeyed tracking cho từng key
  const groups = []; // { keyId, numbers[], type: 'register'|'query' }

  if (unkeyedTrackings.length > 0) {
    console.log(`${label} ${unkeyedTrackings.length} unkeyed, syncing quota...`);
    const allKeys = await apiKeyRepo.getAll();
    const activeKeys = [];
    for (const key of allKeys.filter(k => k.status === 'active')) {
      try {
        const quota = await trackService.getQuota(key.apiKey);
        await apiKeyRepo.update(key.id, {
          quotaTotal: quota.quotaTotal,
          quotaUsed: quota.quotaUsed,
          lastSyncedAt: new Date().toISOString()
        });
        activeKeys.push({...key, quotaTotal: quota.quotaTotal, quotaUsed: quota.quotaUsed});
      } catch (err) {
        console.error(`${label} Sync quota failed for ${key.name}:`, err.message);
        activeKeys.push(key);
      }
    }
    activeKeys.sort((a, b) => a.quotaUsed / a.quotaTotal - b.quotaUsed / b.quotaTotal);

    let remaining = unkeyedTrackings.map(t => t.trackingNumber);
    for (const key of activeKeys) {
      if (remaining.length === 0) break;
      const quotaRemain = Math.max(0, (key.quotaTotal || 0) - (key.quotaUsed || 0));
      if (quotaRemain <= 0) continue;
      const batchSize = Math.min(quotaRemain, 30, remaining.length);
      groups.push({keyId: key.id, keyName: key.name, numbers: remaining.slice(0, batchSize), type: 'register'});
      remaining = remaining.slice(batchSize);
    }
    if (remaining.length > 0) {
      console.warn(`${label} ${remaining.length} trackings skipped (no quota)`);
    }
  }

  // Keyed groups → query only
  for (const [keyId, trackings] of groupedTrackings) {
    groups.push({keyId, numbers: trackings.map(t => t.trackingNumber), type: 'query'});
  }

  // Step 5: Create job doc + publish PubSub per group
  const db = getFirestore();
  const jobRef = db.collection('tracking_recheck_jobs').doc();
  const groupMap = {};
  groups.forEach((g, i) => {
    groupMap[String(i)] = {
      keyId: g.keyId,
      keyName: g.keyName || '',
      type: g.type,
      count: g.numbers.length,
      status: 'pending'
    };
  });
  await jobRef.set({
    id: jobRef.id,
    status: 'processing',
    totalGroups: groups.length,
    processedGroups: 0,
    totalRegistered: 0,
    totalQueried: 0,
    totalUpdated: 0,
    groups: groupMap,
    createdAt: new Date().toISOString()
  });

  const topic = pubsub.topic(TOPIC_RECHECK_TRACKING_GROUP);
  const [exists] = await topic.exists();
  if (!exists) await topic.create();

  await Promise.all(
    groups.map((g, i) =>
      topic.publishMessage({
        json: {jobId: jobRef.id, index: i, keyId: g.keyId, numbers: g.numbers, type: g.type}
      })
    )
  );

  const summary = {
    jobId: jobRef.id,
    groups: groups.length,
    registerGroups: groups.filter(g => g.type === 'register').length,
    queryGroups: groups.filter(g => g.type === 'query').length,
    totalTrackings: groups.reduce((s, g) => s + g.numbers.length, 0)
  };
  console.log(`${label} Published ${groups.length} groups:`, summary);
  return summary;
}

/**
 * PubSub handler: xử lý 1 group (register hoặc query).
 * Cập nhật job doc trong Firestore cho real-time progress.
 */
export async function processTrackingGroup(message) {
  let data;
  if (message.json) data = message.json;
  else if (message.data) data = JSON.parse(Buffer.from(message.data, 'base64').toString());
  else if (message.message?.data) data = JSON.parse(Buffer.from(message.message.data, 'base64').toString());
  else data = message;

  const {jobId, index, keyId, numbers, type} = data;
  const groupLabel = `[RecheckGroup:${index}:${keyId?.slice(0, 8)}]`;
  console.log(`${groupLabel} Processing ${type} for ${numbers.length} trackings`);

  const db = getFirestore();
  let registeredCount = 0;
  let queriedCount = 0;
  let updatedCount = 0;

  try {
    if (type === 'register') {
      // Register + query
      const regResult = await trackService.registerTrackings(numbers, {keyId});
      registeredCount = regResult.accepted?.length || 0;

      // Bind apiKeyId cho accepted
      if (regResult.accepted?.length && regResult.keyMap) {
        const now = new Date().toISOString();
        const updates = regResult.accepted.map(n => {
          const km = regResult.keyMap[String(n)] || {};
          return {
            trackingNumber: String(n),
            apiKeyId: km.keyId || '',
            apiKeyName: km.keyName || '',
            isRegistered: true,
            lastCheckedAt: now
          };
        });
        await statusRepo.bulkUpsert(updates);
      }

      // Rejected → xóa apiKeyId, ghi lý do
      if (regResult.rejected?.length) {
        const now = new Date().toISOString();
        const clearUpdates = regResult.rejected.map(n => ({
          trackingNumber: String(n),
          apiKeyId: '',
          apiKeyName: '',
          isRegistered: false,
          lastEvent: `Registration rejected by key: ${keyId?.slice(0, 8)}`,
          lastCheckedAt: now
        }));
        await statusRepo.bulkUpsert(clearUpdates);
      }

      console.log(`${groupLabel} Registered ${registeredCount}/${numbers.length}`);

      // Query accepted trackings ngay sau register
      if (regResult.accepted?.length) {
        const queryResult = await trackService.getTrackInfo(
          regResult.accepted.map(n => String(n)),
          {keyId}
        );
        queriedCount = queryResult.results?.length || 0;
        if (queryResult.results?.length) {
          updatedCount = await upsertTrackResults(queryResult.results);
        }
      }
    } else {
      // Query only (FREE)
      queriedCount = numbers.length;
      const queryResult = await trackService.getTrackInfo(numbers, {keyId});

      if (queryResult.rejected?.length) {
        console.warn(`${groupLabel} ${queryResult.rejected.length} rejected (skipping, already registered)`);
      }

      if (queryResult.results?.length) {
        updatedCount = await upsertTrackResults(queryResult.results);
      }
      console.log(`${groupLabel} Queried ${numbers.length}, updated ${updatedCount}`);
    }

    await updateRecheckJobGroup(db, jobId, index, 'done', {
      registered: registeredCount,
      queried: queriedCount,
      updated: updatedCount
    });
  } catch (err) {
    console.error(`${groupLabel} Error:`, err.message);
    await updateRecheckJobGroup(db, jobId, index, 'error', {
      registered: registeredCount,
      queried: queriedCount,
      updated: updatedCount,
      error: err.message
    });
    throw err;
  }
}

/** Upsert track results to Firestore */
async function upsertTrackResults(results) {
  const now = new Date().toISOString();
  const updates = results.map(r => ({
    trackingNumber: r.trackingNumber,
    carrier: r.carrier || '',
    carrierCode: r.carrierCode || 0,
    status: r.status || 'pending',
    statusCode: r.statusCode || 0,
    lastEvent: r.lastEvent || '',
    lastEventDate: r.lastEventDate || '',
    isRegistered: true,
    isDelivered: FINAL_STATUSES.includes(r.status),
    lastCheckedAt: now
  }));
  return statusRepo.bulkUpsert(updates);
}

/** Update recheck job doc with per-group progress (atomic field updates, no transaction) */
async function updateRecheckJobGroup(db, jobId, index, status, counts = {}) {
  if (!jobId) return;
  try {
    const jobRef = db.collection('tracking_recheck_jobs').doc(jobId);
    const key = String(index);

    // Step 1: Atomic update — each handler writes only its own group fields + increments
    await jobRef.update({
      [`groups.${key}.status`]: status,
      [`groups.${key}.registered`]: counts.registered || 0,
      [`groups.${key}.queried`]: counts.queried || 0,
      [`groups.${key}.updated`]: counts.updated || 0,
      ...(counts.error ? {[`groups.${key}.error`]: counts.error} : {}),
      processedGroups: FieldValue.increment(1),
      totalRegistered: FieldValue.increment(counts.registered || 0),
      totalQueried: FieldValue.increment(counts.queried || 0),
      totalUpdated: FieldValue.increment(counts.updated || 0)
    });

    // Step 2: Check completion (idempotent — safe if multiple handlers reach here)
    const jobDoc = await jobRef.get();
    const job = jobDoc.data();
    if (job.processedGroups >= job.totalGroups && job.status !== 'completed') {
      await jobRef.update({status: 'completed', completedAt: new Date().toISOString()});
    }
  } catch (err) {
    console.error(`[UpdateRecheckJob] jobId=${jobId} error:`, err.message);
  }
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

/** Sync quota from 17TRACK API for ALL keys */
export async function syncAllKeysQuota(req, res) {
  try {
    const keys = await apiKeyRepo.getAll();
    const results = [];
    for (const key of keys) {
      try {
        const quota = await trackService.getQuota(key.apiKey);
        await apiKeyRepo.update(key.id, {
          quotaTotal: quota.quotaTotal,
          quotaUsed: quota.quotaUsed,
          quotaRemain: quota.quotaRemain,
          todayUsed: quota.todayUsed,
          lastSyncedAt: new Date().toISOString()
        });
        results.push({id: key.id, name: key.name, success: true, quota});
      } catch (err) {
        results.push({id: key.id, name: key.name, success: false, error: err.message});
      }
    }
    res.json({success: true, data: results});
  } catch (err) {
    console.error('[TrackingStatus] syncAllKeysQuota error:', err.message);
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

/** Update an API key by id (whitelist allowed fields) */
export async function updateApiKey(req, res) {
  try {
    const {id} = req.params;
    const allowed = ['name', 'status', 'quotaTotal'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({success: false, error: 'No valid fields to update'});
    }
    await apiKeyRepo.update(id, updates);
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

/** List statuses with optional filters: storeId, storeIds, all, status, stale, limit + server-side pagination */
export async function listStatuses(req, res) {
  try {
    const {storeId, storeIds, all, status, stale, limit = 5000} = req.query;
    const parsedLimit = parseInt(limit);
    const {page, perPage, search} = parsePaginationParams(req.query);
    let records;

    // Special: stale=1 overrides all other filters
    if (stale === '1' || stale === 'true') {
      records = await statusRepo.getStaleTrackings(parsedLimit);
    } else if (all === 'true' || all === '1') {
      records = status
        ? await statusRepo.getByStatus(status, parsedLimit)
        : await statusRepo.getAll(parsedLimit);
    } else if (storeId) {
      records = status
        ? await statusRepo.getByStoreAndStatus(storeId, status, parsedLimit)
        : await statusRepo.getByStore(storeId, parsedLimit);
    } else if (storeIds) {
      const ids = storeIds.split(',').filter(Boolean);
      const perStore = await Promise.all(
        ids.map(id => status
          ? statusRepo.getByStoreAndStatus(id, status, parsedLimit)
          : statusRepo.getByStore(id, parsedLimit)
        )
      );
      records = perStore.flat();
    } else {
      return res.json({success: true, data: [], pagination: {page: 1, perPage, total: 0, totalPages: 1}});
    }

    // Exclude hidden trackings by default
    records = records.filter(r => !r.isHidden);

    const result = paginateArray(records, {
      page, perPage, search,
      searchKeys: ['trackingNumber', 'orderNumber', 'lastEvent', 'apiKeyName']
    });
    res.json({success: true, ...result});
  } catch (err) {
    console.error('[TrackingStatus] listStatuses error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Hide a tracking (isHidden = true) */
export async function hideTracking(req, res) {
  try {
    const {id} = req.params;
    await statusRepo.setHidden(id, true);
    res.json({success: true});
  } catch (err) {
    console.error('[TrackingStatus] hideTracking error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Remove a single tracking by id */
export async function removeTracking(req, res) {
  try {
    const {id} = req.params;
    await statusRepo.deleteById(id);
    res.json({success: true});
  } catch (err) {
    console.error('[TrackingStatus] removeTracking error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Remove multiple trackings by ids (max 500 per request) */
export async function bulkRemoveTrackings(req, res) {
  try {
    const {ids} = req.body;
    if (!ids?.length) return res.status(400).json({success: false, error: 'ids array required'});
    if (ids.length > 500) return res.status(400).json({success: false, error: 'Max 500 ids per request'});
    const deleted = await statusRepo.deleteByIds(ids);
    res.json({success: true, data: {deleted}});
  } catch (err) {
    console.error('[TrackingStatus] bulkRemoveTrackings error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Unhide a tracking (isHidden = false) */
export async function unhideTracking(req, res) {
  try {
    const {id} = req.params;
    await statusRepo.setHidden(id, false);
    res.json({success: true});
  } catch (err) {
    console.error('[TrackingStatus] unhideTracking error:', err.message);
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

/**
 * Clear invalid tracking records (scientific notation numbers, expired rejects).
 * DELETE /api/tracking-status/statuses/clear-invalid
 */
export async function clearInvalidStatuses(req, res) {
  try {
    const deleted = await statusRepo.deleteInvalid();
    res.json({success: true, data: {deleted}});
  } catch (err) {
    console.error('[TrackingStatus] clearInvalidStatuses error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Manual trigger: run the full status check cycle, optionally filtered by statuses */
export async function triggerStatusCheck(req, res) {
  try {
    // Read statuses from query param (comma-separated) or body
    const qsStatuses = req.query.statuses ? req.query.statuses.split(',') : null;
    const {status, statuses} = req.body || {};
    const statusFilter = qsStatuses || (statuses?.length ? statuses : (status ? [status] : null));
    console.log('[TriggerCheck] statusFilter:', statusFilter);
    const summary = await processTrackingStatusQueue({statuses: statusFilter});
    res.json({success: true, data: summary});
  } catch (err) {
    console.error('[TrackingStatus] triggerStatusCheck error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** Dashboard stats: combined API key + status stats (supports storeId/storeIds filter) */
export async function getDashboardStats(req, res) {
  try {
    const {storeId, storeIds, all} = req.query;
    let filterStoreIds = null;
    if (storeId) {
      filterStoreIds = [storeId];
    } else if (storeIds) {
      filterStoreIds = storeIds.split(',').filter(Boolean);
    }
    // If all=true or no store filter, get global stats
    if (all === 'true' || all === '1') filterStoreIds = null;

    const [keyStats, statusStats] = await Promise.all([
      apiKeyRepo.getStats(),
      statusRepo.getStats(filterStoreIds)
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
    const {storeId, storeIds, keyId} = req.body;
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
    const storeMap = {};
    targetStores.forEach(s => {
      storeMap[s.id] = {
        storeName: s.name || s.shopDomain,
        status: 'pending'
      };
    });
    await jobRef.set({
      id: jobRef.id,
      status: 'processing',
      totalStores: targetStores.length,
      processedStores: 0,
      totalRegistered: 0,
      totalQueried: 0,
      totalUpdated: 0,
      stores: storeMap,
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
            jobId: jobRef.id,
            ...(keyId && {keyId})
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
    const {trackingNumber, carrier, orderNumber, storeId, keyId} = req.body;
    if (!trackingNumber) {
      return res.status(400).json({success: false, error: 'trackingNumber is required'});
    }

    // Check if already in history (use existing key if bound)
    const existing = await statusRepo.getByTrackingNumber(trackingNumber);
    const isNew = !existing;
    const existingKeyId = existing?.apiKeyId || null;
    // Priority: explicit keyId > existing bound key > auto
    const effectiveKeyId = keyId || existingKeyId || null;
    const keyOpts = effectiveKeyId ? {keyId: effectiveKeyId} : {};

    let usedKeyId = effectiveKeyId;
    let usedKeyName = null;
    const warnings = [];

    // Register if new (costs quota)
    if (isNew) {
      const regResult = await trackService.registerTrackings([trackingNumber], keyOpts);
      if (regResult.usedKeys?.length) {
        usedKeyId = regResult.usedKeys[0].id;
        usedKeyName = regResult.usedKeys[0].name;
      }
      if (regResult.rejected?.length > 0) {
        warnings.push(`Register rejected: ${regResult.rejected.join(', ')}`);
      }
      if (regResult.error) {
        warnings.push(`Register: ${regResult.error}`);
      }
    }

    // Query status (free) — use the same key that registered it
    const queryOpts = usedKeyId ? {keyId: usedKeyId} : {};
    let result = null;
    let queryResult = await trackService.getTrackInfo([trackingNumber], queryOpts);
    result = queryResult.results[0] || null;
    if (queryResult.usedKeys?.length) {
      usedKeyId = queryResult.usedKeys[0].id;
      usedKeyName = queryResult.usedKeys[0].name;
    }

    // Auto-register ONLY if not already registered (avoid double quota cost)
    const needsRegister = queryResult.rejected?.some(r => r.error?.includes('does not register'));
    if (!result && needsRegister && !isNew) {
      // Existing tracking lost its registration — re-register once
      console.log(`[CheckSingle] ${trackingNumber} not registered, auto-registering...`);
      const regResult = await trackService.registerTrackings([trackingNumber], keyOpts);
      const regKeyId = regResult.usedKeys?.[0]?.id;
      if (regResult.usedKeys?.length) {
        usedKeyId = regResult.usedKeys[0].id;
        usedKeyName = regResult.usedKeys[0].name;
      }
      if (regResult.error) {
        warnings.push(`Auto-register: ${regResult.error}`);
      } else {
        // Re-query with SAME key that registered
        await new Promise(r => setTimeout(r, 3000));
        const reQueryOpts = regKeyId ? {keyId: regKeyId} : keyOpts;
        queryResult = await trackService.getTrackInfo([trackingNumber], reQueryOpts);
        result = queryResult.results[0] || null;
        if (queryResult.usedKeys?.length) {
          usedKeyId = queryResult.usedKeys[0].id;
          usedKeyName = queryResult.usedKeys[0].name;
        }
      }
    } else if (!result && needsRegister && isNew) {
      // Just registered above but 17TRACK hasn't indexed yet — wait and retry query only
      console.log(`[CheckSingle] ${trackingNumber} just registered, waiting for 17TRACK to index...`);
      await new Promise(r => setTimeout(r, 3000));
      queryResult = await trackService.getTrackInfo([trackingNumber], queryOpts);
      result = queryResult.results[0] || null;
      if (queryResult.usedKeys?.length) {
        usedKeyId = queryResult.usedKeys[0].id;
        usedKeyName = queryResult.usedKeys[0].name;
      }
      if (!result) {
        warnings.push('17TRACK has not indexed this tracking yet, try again later');
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
      apiKeyId: usedKeyId || existing?.apiKeyId || '',
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
  let data;
  if (message.json) {
    data = message.json;
  } else if (message.data) {
    data = JSON.parse(Buffer.from(message.data, 'base64').toString());
  } else if (message.message?.data) {
    data = JSON.parse(
      Buffer.from(message.message.data, 'base64').toString()
    );
  } else {
    data = message;
  }
  const {storeId, shopDomain, jobId, keyId} = data;
  const keyOpts = keyId ? {keyId} : {};
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

    // Step 3: Compare with existing history (keep apiKeyId info)
    const existingMap = {};
    const numbers = allTrackings.map(t => t.trackingNumber);
    for (let i = 0; i < numbers.length; i += 30) {
      const chunk = numbers.slice(i, i + 30);
      const existing = await statusRepo.getByTrackingNumbers(chunk);
      existing.forEach(r => { existingMap[r.trackingNumber] = r; });
    }

    const newTrackings = allTrackings.filter(t => !existingMap[t.trackingNumber]);

    // Step 4: Register new trackings and store per-number apiKeyId
    let regKeyMap = {};
    if (newTrackings.length > 0) {
      try {
        const regResult = await trackService.registerTrackings(
          newTrackings.map(t => t.trackingNumber), keyOpts
        );
        registeredCount = regResult.accepted?.length || 0;
        regKeyMap = regResult.keyMap || {};
      } catch (err) {
        console.error(`[CheckStoreTracking] ${shopDomain}: register error:`, err.message);
      }

      const now = new Date().toISOString();
      const newRecords = newTrackings.map(t => {
        const km = regKeyMap[String(t.trackingNumber)] || {};
        return {
          ...t,
          status: 'pending',
          statusCode: 0,
          isRegistered: true,
          isDelivered: false,
          apiKeyId: km.keyId || '',
          apiKeyName: km.keyName || '',
          lastCheckedAt: now
        };
      });
      await statusRepo.bulkUpsert(newRecords);
    }

    // Step 5: Group trackings by apiKeyId, query each group with its key
    // Skip final-status trackings (delivered/expired) — no need to re-query
    const groupedByKey = new Map();
    for (const t of allTrackings) {
      const existing = existingMap[t.trackingNumber];
      if (existing && FINAL_STATUSES.includes(existing.status)) continue;
      const km = regKeyMap[String(t.trackingNumber)];
      const trackKeyId = existing?.apiKeyId || km?.keyId || '__none__';
      if (!groupedByKey.has(trackKeyId)) groupedByKey.set(trackKeyId, []);
      groupedByKey.get(trackKeyId).push(t.trackingNumber);
    }

    // IMPORTANT: getTrackInfo is FREE (no quota). Never auto-register during query.
    queriedCount = [...groupedByKey.values()].reduce((s, arr) => s + arr.length, 0);
    const trackResults = [];

    // Get all active keys for legacy key discovery
    const allActiveKeys = await apiKeyRepo.getAll();
    const activeKeys = allActiveKeys.filter(k => k.status === 'active');

    for (const [groupKeyId, groupNumbers] of groupedByKey) {
      const isLegacy = groupKeyId === '__none__';
      const groupLabel = isLegacy ? 'no-key' : groupKeyId.slice(0, 8);

      if (!isLegacy) {
        // Non-legacy: query with bound key
        try {
          const queryResult = await trackService.getTrackInfo(groupNumbers, {keyId: groupKeyId});
          const usedKeyName = queryResult.usedKeys?.[0]?.name || '';
          for (const r of queryResult.results) {
            r._apiKeyId = groupKeyId;
            r._apiKeyName = usedKeyName;
          }
          trackResults.push(...queryResult.results);

          // Rejected = key mismatch or error → mark expired
          if (queryResult.rejected?.length) {
            const now = new Date().toISOString();
            const rejUpdates = queryResult.rejected.map(r => ({
              trackingNumber: r.number,
              status: 'expired',
              statusCode: 0,
              isDelivered: false,
              isRegistered: false,
              lastEvent: `Rejected by 17TRACK: ${r.error || 'unknown'}`,
              lastCheckedAt: now
            }));
            await statusRepo.bulkUpsert(rejUpdates);
          }
        } catch (err) {
          console.error(`[CheckStoreTracking] ${shopDomain} group ${groupLabel} error:`, err.message);
        }
      } else {
        // Legacy: try each key to discover which one owns each tracking (FREE queries)
        const remaining = new Set(groupNumbers);
        for (const tryKey of activeKeys) {
          if (remaining.size === 0) break;
          try {
            const queryResult = await trackService.getTrackInfo([...remaining], {keyId: tryKey.id});
            if (queryResult.results.length > 0) {
              for (const r of queryResult.results) {
                r._apiKeyId = tryKey.id;
                r._apiKeyName = tryKey.name;
              }
              // Bind apiKeyId for future queries
              const bindUpdates = queryResult.results.map(r => ({
                trackingNumber: r.trackingNumber,
                apiKeyId: tryKey.id,
                apiKeyName: tryKey.name
              }));
              await statusRepo.bulkUpsert(bindUpdates);
              trackResults.push(...queryResult.results);
              queryResult.results.forEach(r => remaining.delete(r.trackingNumber));
            }
          } catch (err) {
            console.error(`[CheckStoreTracking] ${shopDomain} legacy key ${tryKey.name} error:`, err.message);
          }
        }
        // Remaining = not found on any key → mark unregistered for next cycle
        if (remaining.size > 0) {
          const now = new Date().toISOString();
          const unregUpdates = [...remaining].map(n => ({
            trackingNumber: n,
            isRegistered: false,
            lastCheckedAt: now
          }));
          await statusRepo.bulkUpsert(unregUpdates);
        }
      }
    }

    // Step 6: Upsert results (include apiKeyId from query)
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
          apiKeyId: result._apiKeyId || '',
          apiKeyName: result._apiKeyName || ''
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

    // Step 1: Atomic update — each handler writes only its store fields + increments
    await jobRef.update({
      [`stores.${storeId}.status`]: status,
      [`stores.${storeId}.registered`]: counts.registered || 0,
      [`stores.${storeId}.queried`]: counts.queried || 0,
      [`stores.${storeId}.updated`]: counts.updated || 0,
      ...(counts.error ? {[`stores.${storeId}.error`]: counts.error} : {}),
      processedStores: FieldValue.increment(1),
      totalRegistered: FieldValue.increment(counts.registered || 0),
      totalQueried: FieldValue.increment(counts.queried || 0),
      totalUpdated: FieldValue.increment(counts.updated || 0)
    });

    // Step 2: Check completion
    const jobDoc = await jobRef.get();
    const job = jobDoc.data();
    if (job.processedStores >= job.totalStores && job.status !== 'completed') {
      await jobRef.update({status: 'completed', completedAt: new Date().toISOString()});
    }
  } catch (err) {
    console.error(`[UpdateJobStatus] jobId=${jobId} error:`, err.message);
  }
}
