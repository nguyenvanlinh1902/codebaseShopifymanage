import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';

const storeRepo = new StoreRepository();

/**
 * Helper: Validate and normalize shop domain
 */
function validateAndNormalizeShopDomain(shopDomain) {
  if (!shopDomain) {
    throw new Error('Shop domain is required');
  }

  const normalized = ShopifyService.normalizeShopDomain(shopDomain);

  if (!normalized) {
    throw new Error('Invalid shop domain format');
  }

  return normalized;
}

/**
 * Helper: Verify Shopify credentials and get shop info
 */
async function verifyAndGetShopInfo(shopDomain, accessToken) {
  const shopifyService = new ShopifyService({
    shopDomain,
    accessToken
  });

  const isValid = await shopifyService.verifyCredentials();
  if (!isValid) {
    throw new Error('Invalid Shopify credentials. Please check your access token and shop domain.');
  }

  return await shopifyService.getShopInfo();
}

/**
 * Helper: Check if store already exists
 */
async function checkStoreExists(shopDomain) {
  const existingStore = await storeRepo.getByShopDomain(shopDomain);
  if (existingStore) {
    throw new Error('Store already exists');
  }
}

/**
 * Helper: Build store data object
 */
function buildStoreData(userId, shopDomain, accessToken, shopInfo, customName, niche) {
  return {
    userId,
    shopDomain,
    accessToken,
    name: customName || shopInfo.name,
    niche: niche || '',
    email: shopInfo.email,
    currency: shopInfo.currency,
    timezone: shopInfo.timezone,
    status: 'active'
  };
}

/**
 * Store Controller
 * Handles store management operations
 */

/**
 * Verify access token and get shop info
 * Requires shop domain for verification
 */
export async function verifyToken(req, res) {
  try {
    const {accessToken, shopDomain} = req.body;

    // Task 1: Validate input
    if (!accessToken || !shopDomain) {
      return res.status(400).json({
        success: false,
        error: 'accessToken and shopDomain are required'
      });
    }

    // Task 2: Normalize shop domain
    const finalShopDomain = validateAndNormalizeShopDomain(shopDomain);

    // Task 3: Verify credentials and get shop info
    const shopInfo = await verifyAndGetShopInfo(finalShopDomain, accessToken);

    return res.json({
      success: true,
      data: {
        shopDomain: finalShopDomain,
        shopName: shopInfo.name,
        email: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone,
        domain: shopInfo.domain,
        myshopifyDomain: shopInfo.myshopify_domain
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Create a new store
 * Separated into clear tasks for maintainability
 */
export async function createStore(req, res) {
  try {
    const {userId, shopDomain, accessToken, name, niche} = req.body;

    // Task 1: Validate required input
    if (!userId || !shopDomain || !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'userId, shopDomain, and accessToken are required'
      });
    }
    const finalShopDomain = validateAndNormalizeShopDomain(shopDomain);
    const shopInfo = await verifyAndGetShopInfo(finalShopDomain, accessToken);

    // Task 4: Check if store already exists in database
    await checkStoreExists(finalShopDomain);

    // Task 5: Build store data object
    const storeData = buildStoreData(
      userId,
      finalShopDomain,
      accessToken,
      shopInfo,
      name,
      niche
    );

    // Task 6: Create store in database
    const store = await storeRepo.create(storeData);

    // Task 7: Sanitize response (don't send accessToken)
    const {accessToken: _, ...sanitizedStore} = store;

    return res.json({
      success: true,
      message: 'Store created successfully',
      data: sanitizedStore
    });
  } catch (error) {
    console.error('Create store error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all stores for a user
 */
export async function getStores(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const stores = await storeRepo.getByUserId(userId);

    // Remove access tokens
    const sanitizedStores = stores.map(store => {
      const {accessToken, ...storeData} = store;
      return storeData;
    });

    return res.json({
      success: true,
      data: sanitizedStores
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

    // Remove access token
    const {accessToken, ...storeData} = store;

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
    const {name, niche, status} = req.body;

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

    const updatedStore = await storeRepo.update(storeId, updateData);

    // Remove access token
    const {accessToken, ...storeData} = updatedStore;

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
 * Delete store
 */
export async function deleteStore(req, res) {
  try {
    const {storeId} = req.params;

    const store = await storeRepo.getById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    await storeRepo.delete(storeId);

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
