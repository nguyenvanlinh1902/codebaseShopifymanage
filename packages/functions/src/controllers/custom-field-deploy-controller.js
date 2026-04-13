import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import customFieldRepo from '../repositories/custom-field-repository.js';

const storeRepo = new StoreRepository();

async function getStoreAndService(storeId) {
  const store = await storeRepo.getById(storeId);
  if (!store) throw new Error(`Store ${storeId} not found`);
  return {
    store,
    service: new ShopifyService({shopDomain: store.shopDomain, accessToken: store.accessToken})
  };
}

/**
 * POST /api/custom-fields/deploy
 * Setup store: create Storefront Token + save field config to shop metafield.
 * Body: { storeIds: string[] }
 */
export async function deployToStores(req, res) {
  try {
    const {storeIds} = req.body;
    if (!storeIds?.length) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }

    const fields = await customFieldRepo.getAll();
    const fieldsConfig = fields.map(f => ({key: f.key, label: f.label, inputType: f.inputType, required: f.required}));

    const results = [];
    for (const storeId of storeIds) {
      const result = {storeId, status: 'success', errors: []};
      try {
        const {store, service} = await getStoreAndService(storeId);
        result.storeName = store.shopDomain;

        // 1. Create Storefront Access Token
        try {
          await service.createStorefrontToken();
          result.token = 'ok';
        } catch (err) {
          result.errors.push(`Storefront token: ${err.message}`);
        }

        // 2. Save field config to shop metafield
        try {
          await service.saveFieldConfig(fieldsConfig);
          result.config = 'ok';
        } catch (err) {
          result.errors.push(`Config: ${err.message}`);
        }

        await customFieldRepo.setDeployment(storeId, {
          storeId, storeName: store.shopDomain,
          deployedAt: new Date().toISOString(),
          fieldCount: fields.length,
          errors: result.errors
        });
      } catch (err) {
        result.status = 'error';
        result.errors.push(err.message);
      }
      results.push(result);
    }

    res.json({success: true, data: results});
  } catch (error) {
    console.error('Error deploying:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/custom-fields/deploy-check
 * Body: { storeIds: string[] }
 */
export async function checkDeployment(req, res) {
  try {
    const {storeIds} = req.body;
    if (!storeIds?.length) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }
    const results = [];
    for (const storeId of storeIds) {
      const deployment = await customFieldRepo.getDeployment(storeId);
      results.push({storeId, deployed: !!deployment, ...(deployment || {})});
    }
    res.json({success: true, data: results});
  } catch (error) {
    res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/custom-fields/collections/:storeId
 * List collections with enabled status from shop metafield.
 */
export async function listStoreCollections(req, res) {
  try {
    const {storeId} = req.params;
    const {service} = await getStoreAndService(storeId);
    const data = await service.listCollections();
    res.json({success: true, data: data.collections});
  } catch (error) {
    console.error('Error listing collections:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/custom-fields/collections/:storeId/toggle
 * Add/remove collection ID from shop metafield toolshopify_cf.collections.
 * Body: { collectionId: string, enabled: boolean }
 */
export async function toggleCollectionCustomFields(req, res) {
  try {
    const {storeId} = req.params;
    const {collectionId, enabled} = req.body;
    if (!collectionId) {
      return res.status(400).json({success: false, error: 'collectionId is required'});
    }

    const {service} = await getStoreAndService(storeId);
    const updatedList = await service.toggleCollection(collectionId, enabled);
    res.json({success: true, data: {collectionId, enabled, totalEnabled: updatedList.length}});
  } catch (error) {
    console.error('Error toggling collection:', error);
    res.status(500).json({success: false, error: error.message});
  }
}
