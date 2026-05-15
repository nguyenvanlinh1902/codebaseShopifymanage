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
 * POST /api/setup/check-policies
 * Fetch current policies for selected stores
 * Body: { storeIds: string[] }
 */
export async function checkPolicies(req, res) {
  try {
    const {storeIds} = req.body;
    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }

    const results = await Promise.all(
      storeIds.map(async storeId => {
        try {
          const {store, shopifyService} = await getStoreAndService(storeId);
          const policies = await shopifyService.getShopPolicies();
          return {storeId, storeName: store.name || store.shopDomain, shopDomain: store.shopDomain, policies};
        } catch (err) {
          return {storeId, storeName: storeId, shopDomain: '', error: err.message, policies: []};
        }
      })
    );

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Check policies error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/setup/disable-auto-policy
 * Disable Shopify-managed Privacy Policy (autoManaged ON → OFF) for selected stores.
 * Body: { storeIds: string[] }
 */
export async function disableAutoPolicy(req, res) {
  try {
    const {storeIds} = req.body;
    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }

    const results = await Promise.all(
      storeIds.map(async storeId => {
        try {
          const {store, shopifyService} = await getStoreAndService(storeId);
          const disabled = await shopifyService.disablePrivacyAutoManaged();
          return {storeId, storeName: store.name || store.shopDomain, disabled};
        } catch (err) {
          return {storeId, error: err.message};
        }
      })
    );

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Disable auto policy error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/setup/apply-policies
 * Apply policy templates to selected stores
 * Body: { storeIds: string[], policies: [{type, body}] }
 */
export async function applyPolicies(req, res) {
  try {
    const {storeIds, policies} = req.body;
    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }
    if (!Array.isArray(policies) || policies.length === 0) {
      return res.status(400).json({success: false, error: 'policies array is required'});
    }

    const results = await Promise.all(
      storeIds.map(async storeId => {
        const {store, shopifyService} = await getStoreAndService(storeId).catch(err => {
          throw Object.assign(err, {storeId});
        });
        const storeResult = {
          storeId,
          storeName: store.name || store.shopDomain,
          shopDomain: store.shopDomain,
          updated: [],
          errors: []
        };

        // Check autoManaged status to skip auto-managed policies
        let privacyAutoManaged = false;
        try {
          const privacySettings = await shopifyService.getPrivacySettings();
          privacyAutoManaged = privacySettings.privacyPolicy?.autoManaged || false;
        } catch { /* ignore */ }

        for (const {type, body} of policies) {
          if (!body || !body.trim()) continue;
          if (type === 'PRIVACY_POLICY' && privacyAutoManaged) {
            storeResult.errors.push({type, error: 'Auto-managed by Shopify. Disable "Use automated policy" in Shopify Admin first.'});
            continue;
          }
          try {
            await shopifyService.updateShopPolicy(type, body);
            storeResult.updated.push(type);
          } catch (err) {
            storeResult.errors.push({type, error: err.message});
          }
        }

        return storeResult;
      }).map(p =>
        p.catch(err => ({
          storeId: err.storeId || 'unknown',
          storeName: err.storeId || 'unknown',
          shopDomain: '',
          updated: [],
          errors: [{type: 'store', error: err.message}]
        }))
      )
    );

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Apply policies error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/setup/check-all
 * Lightweight check of all setup steps for selected stores.
 * Returns per-store status for: metafields, policies, shipping, themes.
 * Body: { storeIds: string[] }
 */
export async function checkAllSteps(req, res) {
  try {
    const {storeIds} = req.body;
    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }

    const results = await Promise.all(
      storeIds.map(async storeId => {
        try {
          const {store, shopifyService} = await getStoreAndService(storeId);
          const storeName = store.name || store.shopDomain;

          // Run all checks in parallel
          const [metafieldStatus, policyStatus, shippingStatus] = await Promise.allSettled([
            checkMetafieldStatus(shopifyService),
            checkPolicyStatus(shopifyService),
            checkShippingStatus(shopifyService)
          ]);

          return {
            storeId,
            storeName,
            shopDomain: store.shopDomain,
            metafields: metafieldStatus.status === 'fulfilled' ? metafieldStatus.value : {done: false, detail: 'Error'},
            policies: policyStatus.status === 'fulfilled' ? policyStatus.value : {done: false, detail: 'Error'},
            shipping: shippingStatus.status === 'fulfilled' ? shippingStatus.value : {done: false, detail: 'Error'},
            themes: {done: false, detail: 'Manual check'}
          };
        } catch (err) {
          return {
            storeId,
            storeName: storeId,
            shopDomain: '',
            error: err.message,
            metafields: {done: false, detail: 'Error'},
            policies: {done: false, detail: 'Error'},
            shipping: {done: false, detail: 'Error'},
            themes: {done: false, detail: 'Error'}
          };
        }
      })
    );

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Check all steps error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

async function checkMetafieldStatus(shopifyService) {
  const ownerTypes = [...new Set(PREDEFINED_METAFIELDS.map(m => m.ownerType))];
  const existingByOwner = {};
  for (const ownerType of ownerTypes) {
    existingByOwner[ownerType] = await shopifyService.getMetafieldDefinitions(ownerType);
  }
  const total = PREDEFINED_METAFIELDS.length;
  const found = PREDEFINED_METAFIELDS.filter(p =>
    (existingByOwner[p.ownerType] || []).some(d => d.namespace === p.namespace && d.key === p.key)
  ).length;
  return {done: found === total, detail: `${found}/${total}`};
}

async function checkPolicyStatus(shopifyService) {
  const policies = await shopifyService.getShopPolicies();
  const filled = (policies || []).filter(p => p.body && p.body.trim().length > 0).length;
  const total = POLICY_TYPES_CHECK.length;
  return {done: filled >= 3, detail: `${filled}/${total} filled`};
}

const POLICY_TYPES_CHECK = ['REFUND_POLICY', 'PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'SHIPPING_POLICY', 'CONTACT_INFORMATION', 'LEGAL_NOTICE'];

async function checkShippingStatus(shopifyService) {
  try {
    const {getDeliveryProfiles} = await import('../services/shopify-shipping-service.js');
    const profiles = await getDeliveryProfiles(shopifyService);
    const totalRates = profiles.reduce((sum, p) =>
      sum + (p.locationGroups || []).reduce((s2, lg) =>
        s2 + (lg.zones || []).reduce((s3, z) => s3 + (z.rates || []).length, 0), 0), 0);
    return {done: totalRates > 0, detail: `${totalRates} rates`};
  } catch {
    return {done: false, detail: 'No access'};
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
