import {StoreRepository} from '../repositories/storeRepository.js';
import {OrderSyncRepository} from '../repositories/orderSyncRepository.js';

const storeRepo = new StoreRepository();
const orderSyncRepo = new OrderSyncRepository();

/**
 * Store Controller
 * Handles store management operations.
 * Stores are created automatically via Shopify OAuth install (shopifyInstallController).
 */

/**
 * Get stores for a user (with pagination, optional search via BigQuery).
 * Admin users see all stores; other roles see only assigned stores.
 */
export async function getStores(req, res) {
  try {
    const {page, limit, search, niche, groupId} = req.query;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const niches = niche ? niche.split(',').filter(Boolean) : [];

    let stores;
    let total;

    if (isAdmin && !search && niches.length === 0) {
      // Admin: return ALL stores
      const result = await storeRepo.getAllPaginated({page: pageNum, limit: limitNum, groupId: groupId || null});
      stores = result.stores;
      total = result.total;
    } else if (search && search.trim()) {
      // Search via BigQuery (supports CONTAINS text + niche filter)
      const result = await storeRepo.searchStores(isAdmin ? null : userId, {
        search: search.trim(),
        page: pageNum,
        limit: limitNum,
        niches
      });
      stores = result.stores;
      total = result.total;
    } else if (niches.length > 0) {
      // Niche filter via BigQuery
      const result = await storeRepo.getByUserIdWithNiches(isAdmin ? null : userId, {
        page: pageNum,
        limit: limitNum,
        niches
      });
      stores = result.stores;
      total = result.total;
    } else {
      // Normal listing via Firestore
      const result = await storeRepo.getByUserIdPaginated(userId, {
        page: pageNum,
        limit: limitNum,
        groupId: groupId || null
      });
      stores = result.stores;
      total = result.total;
    }

    // Remove sensitive fields
    const sanitizedStores = stores.map(s => {
      const copy = {...s};
      delete copy.accessToken;
      delete copy.apiSecret;
      delete copy.document_id;
      return copy;
    });

    return res.json({
      success: true,
      data: sanitizedStores,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get stores error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all unique niche values for a user
 */
export async function getNiches(req, res) {
  try {
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    const niches = isAdmin
      ? await storeRepo.getAllNiches()
      : await storeRepo.getNichesByUserId(userId);

    return res.json({
      success: true,
      data: niches
    });
  } catch (error) {
    console.error('Get niches error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get store by ID
 */
export async function getStore(req, res) {
  try {
    const {storeId} = req.params;

    const store = await storeRepo.getById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Remove access token and api secret
    const storeData = {...store};
    delete storeData.accessToken;
    delete storeData.apiSecret;

    return res.json({
      success: true,
      data: storeData
    });
  } catch (error) {
    console.error('Get store error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update store
 */
export async function updateStore(req, res) {
  try {
    const {storeId} = req.params;
    const {name, niche, status, groupId} = req.body;

    const store = await storeRepo.getById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (niche !== undefined) updateData.niche = niche;
    if (status !== undefined) updateData.status = status;
    if (groupId !== undefined) updateData.groupId = groupId || null;

    const updatedStore = await storeRepo.update(storeId, updateData);

    // Remove access token and api secret
    const storeData = {...updatedStore};
    delete storeData.accessToken;
    delete storeData.apiSecret;

    return res.json({
      success: true,
      message: 'Store updated successfully',
      data: storeData
    });
  } catch (error) {
    console.error('Update store error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Helper: cleanup and delete a single store
 */
async function cleanupAndDeleteStore(storeId) {
  const store = await storeRepo.getById(storeId);
  if (!store) return {storeId, success: false, error: 'Store not found'};

  // Cleanup Firestore webhook records (Shopify manages webhook lifecycle via shopify.app.toml)
  const webhooks = await orderSyncRepo.getWebhooksByStore(storeId);
  for (const webhook of webhooks) {
    await orderSyncRepo.deleteWebhook(webhook.id);
  }

  // Deactivate sync configs
  const syncConfigs = await orderSyncRepo.getSyncJobsByStore(storeId);
  for (const config of syncConfigs) {
    await orderSyncRepo.updateSyncJob(config.id, {status: 'inactive'});
  }

  await storeRepo.delete(storeId);
  return {storeId, success: true};
}

/**
 * Delete store
 */
export async function deleteStore(req, res) {
  try {
    const {storeId} = req.params;

    const result = await cleanupAndDeleteStore(storeId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Delete store error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Bulk delete stores
 */
export async function bulkDeleteStores(req, res) {
  try {
    const {storeIds} = req.body;

    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'storeIds array is required'
      });
    }

    const results = await Promise.allSettled(storeIds.map(id => cleanupAndDeleteStore(id)));

    const deleted = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - deleted;

    return res.json({
      success: true,
      message: `Deleted ${deleted} store(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      deleted,
      failed
    });
  } catch (error) {
    console.error('Bulk delete stores error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
