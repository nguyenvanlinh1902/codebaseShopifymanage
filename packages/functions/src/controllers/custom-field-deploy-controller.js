import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import customFieldRepo from '../repositories/custom-field-repository.js';

const storeRepo = new StoreRepository();

async function getStoreAndService(storeId) {
  const store = await storeRepo.getById(storeId);
  if (!store) throw new Error(`Store ${storeId} not found`);
  return {
    store,
    service: new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    })
  };
}

/**
 * POST /api/custom-fields/deploy
 * Deploy metafield definitions to selected stores.
 * Theme code must be added manually by user.
 * Body: { storeIds: string[] }
 */
export async function deployToStores(req, res) {
  try {
    const {storeIds} = req.body;
    if (!storeIds?.length) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }

    const fields = await customFieldRepo.getAll();
    if (!fields.length) {
      return res.status(400).json({success: false, error: 'No custom field definitions to deploy'});
    }

    const results = [];
    for (const storeId of storeIds) {
      const result = {storeId, status: 'success', created: 0, skipped: 0, errors: []};
      try {
        const {store, service} = await getStoreAndService(storeId);
        result.storeName = store.shopDomain;

        const existing = await service.getMetafieldDefinitions('PRODUCT');
        for (const field of fields) {
          const exists = existing.find(d => d.namespace === field.namespace && d.key === field.key);
          if (exists) {
            result.skipped++;
            continue;
          }
          try {
            await service.createMetafieldDefinition({
              name: field.label,
              namespace: field.namespace,
              key: field.key,
              type: field.type,
              ownerType: 'PRODUCT',
              description: `Custom field: ${field.label} (${field.inputType})`
            });
            result.created++;
          } catch (err) {
            result.errors.push(`Metafield ${field.key}: ${err.message}`);
          }
        }

        await customFieldRepo.setDeployment(storeId, {
          storeId,
          storeName: store.shopDomain,
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
    console.error('Error deploying custom fields:', error);
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
      results.push({
        storeId,
        deployed: !!deployment,
        ...(deployment || {})
      });
    }

    res.json({success: true, data: results});
  } catch (error) {
    console.error('Error checking deployment:', error);
    res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/custom-fields/undeploy
 * Remove metafield definitions from selected stores.
 * Body: { storeIds: string[] }
 */
export async function undeployFromStores(req, res) {
  try {
    const {storeIds} = req.body;
    if (!storeIds?.length) {
      return res.status(400).json({success: false, error: 'storeIds array is required'});
    }

    const fields = await customFieldRepo.getAll();
    const results = [];

    for (const storeId of storeIds) {
      const result = {storeId, status: 'success', removed: 0, errors: []};
      try {
        const {store, service} = await getStoreAndService(storeId);
        result.storeName = store.shopDomain;

        const existing = await service.getMetafieldDefinitions('PRODUCT');
        for (const field of fields) {
          const def = existing.find(d => d.namespace === field.namespace && d.key === field.key);
          if (def) {
            try {
              await service.deleteMetafieldDefinition(def.id, false);
              result.removed++;
            } catch (err) {
              result.errors.push(`Delete ${field.key}: ${err.message}`);
            }
          }
        }

        await customFieldRepo.deleteDeployment(storeId);
      } catch (err) {
        result.status = 'error';
        result.errors.push(err.message);
      }
      results.push(result);
    }

    res.json({success: true, data: results});
  } catch (error) {
    console.error('Error undeploying custom fields:', error);
    res.status(500).json({success: false, error: error.message});
  }
}
