import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';

const storeRepo = new StoreRepository();

/**
 * Predefined metafield definitions to setup on new stores
 */
const PREDEFINED_METAFIELDS = [
  {
    name: 'SEO Hidden',
    namespace: 'seo',
    key: 'hidden',
    type: 'number_integer',
    ownerType: 'PRODUCT',
    description: 'Hide product from search engines and sitemap. Set to 1 to hide',
    pin: true
  }
];

/**
 * Helper: Get store and create ShopifyService instance
 */
async function getStoreAndService(storeId) {
  const store = await storeRepo.getById(storeId);
  if (!store) {
    throw new Error('Store not found');
  }

  const shopifyService = new ShopifyService({
    shopDomain: store.shopDomain,
    accessToken: store.accessToken
  });

  return {store, shopifyService};
}

/**
 * GET /api/setup/definitions
 * Return the list of predefined metafield definitions
 */
export async function getDefinitions(req, res) {
  try {
    return res.json({
      success: true,
      data: PREDEFINED_METAFIELDS
    });
  } catch (error) {
    console.error('Get definitions error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/setup/check
 * Check which stores are missing predefined metafield definitions
 * Body: { storeIds: string[] }
 */
export async function checkStores(req, res) {
  try {
    const {storeIds} = req.body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'storeIds array is required'
      });
    }

    const results = [];

    for (const storeId of storeIds) {
      try {
        const {store, shopifyService} = await getStoreAndService(storeId);

        // Get unique owner types from predefined metafields
        const ownerTypes = [...new Set(PREDEFINED_METAFIELDS.map(m => m.ownerType))];

        // Fetch existing definitions for each owner type
        const existingByOwner = {};
        for (const ownerType of ownerTypes) {
          const definitions = await shopifyService.getMetafieldDefinitions(ownerType);
          existingByOwner[ownerType] = definitions;
        }

        // Check each predefined metafield
        const metafields = PREDEFINED_METAFIELDS.map(predefined => {
          const existing = (existingByOwner[predefined.ownerType] || []).find(
            d => d.namespace === predefined.namespace && d.key === predefined.key
          );
          return {
            name: predefined.name,
            namespace: predefined.namespace,
            key: predefined.key,
            type: predefined.type,
            ownerType: predefined.ownerType,
            status: existing ? 'exists' : 'missing'
          };
        });

        results.push({
          storeId,
          storeName: store.name || store.shopDomain,
          shopDomain: store.shopDomain,
          metafields
        });
      } catch (error) {
        results.push({
          storeId,
          storeName: storeId,
          shopDomain: '',
          error: error.message,
          metafields: PREDEFINED_METAFIELDS.map(p => ({
            name: p.name,
            namespace: p.namespace,
            key: p.key,
            type: p.type,
            ownerType: p.ownerType,
            status: 'error'
          }))
        });
      }
    }

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Check stores error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/setup/apply
 * Create missing metafield definitions on selected stores
 * Body: { storeIds: string[] }
 */
export async function applySetup(req, res) {
  try {
    const {storeIds} = req.body;

    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'storeIds array is required'
      });
    }

    const results = [];

    for (const storeId of storeIds) {
      try {
        const {store, shopifyService} = await getStoreAndService(storeId);

        // Get unique owner types
        const ownerTypes = [...new Set(PREDEFINED_METAFIELDS.map(m => m.ownerType))];

        // Fetch existing definitions
        const existingByOwner = {};
        for (const ownerType of ownerTypes) {
          const definitions = await shopifyService.getMetafieldDefinitions(ownerType);
          existingByOwner[ownerType] = definitions;
        }

        const storeResult = {
          storeId,
          storeName: store.name || store.shopDomain,
          shopDomain: store.shopDomain,
          created: [],
          skipped: [],
          errors: []
        };

        for (const predefined of PREDEFINED_METAFIELDS) {
          const existing = (existingByOwner[predefined.ownerType] || []).find(
            d => d.namespace === predefined.namespace && d.key === predefined.key
          );

          if (existing) {
            storeResult.skipped.push({
              name: predefined.name,
              reason: 'Already exists'
            });
            continue;
          }

          try {
            await shopifyService.createMetafieldDefinition({
              name: predefined.name,
              namespace: predefined.namespace,
              key: predefined.key,
              type: predefined.type,
              ownerType: predefined.ownerType,
              description: predefined.description,
              pin: predefined.pin
            });
            storeResult.created.push({name: predefined.name});
          } catch (err) {
            storeResult.errors.push({
              name: predefined.name,
              error: err.message
            });
          }
        }

        results.push(storeResult);
      } catch (error) {
        results.push({
          storeId,
          storeName: storeId,
          shopDomain: '',
          created: [],
          skipped: [],
          errors: [{name: 'Store', error: error.message}]
        });
      }
    }

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Apply setup error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
