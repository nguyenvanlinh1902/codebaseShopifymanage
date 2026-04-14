/**
 * Shopify Product Controller — fetch products directly from Shopify GraphQL API.
 * RBAC: admin sees all stores, non-admin sees assigned stores only.
 */

import {StoreRepository} from '../repositories/storeRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {extractStoreIds} from '../utils/store-access.js';
import {listShopifyProducts} from '../services/shopify-product-list-service.js';
import {executeBulkAction} from '../services/shopify-product-bulk-service.js';

const storeRepo = new StoreRepository();
const adminUserRepo = new AdminUserRepository();

async function getPermittedStoreIds(req) {
  if (req.userRole === 'admin') return null;
  const userRecord = await adminUserRepo.getById(req.userId);
  return extractStoreIds(userRecord?.assignedStores);
}

async function getShopify(storeId) {
  const store = await storeRepo.getById(storeId);
  if (!store) throw new Error(`Store ${storeId} not found`);
  const svc = new ShopifyService({shopDomain: store.shopDomain, accessToken: store.accessToken});
  return svc.shopify;
}

async function validateStoreAccess(req, storeId) {
  if (!storeId) throw new Error('storeId is required');
  const permitted = await getPermittedStoreIds(req);
  if (permitted !== null && !permitted.includes(storeId)) {
    throw Object.assign(new Error('Access denied to this store'), {status: 403});
  }
}

/** GET /api/shopify-products/list */
export async function list(req, res) {
  try {
    const {storeId, query, after, first, sortKey, reverse} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await listShopifyProducts(shopify, {
      first: parseInt(first) || 50,
      after: after || null,
      query: query || null,
      sortKey: sortKey || 'TITLE',
      reverse: reverse === 'true'
    });
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[shopify-products] list error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** POST /api/shopify-products/bulk-action */
export async function bulkAction(req, res) {
  try {
    const {storeId, productIds, action, tags, collectionId} = req.body;
    if (!storeId || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({success: false, error: 'storeId and productIds are required'});
    }
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await executeBulkAction(shopify, {productIds, action, tags, collectionId});
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[shopify-products] bulkAction error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** GET /api/shopify-products/collections */
export async function listCollections(req, res) {
  try {
    const {storeId, query} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    // Build query — filter custom collections only (smart collections can't be modified)
    const queryParts = ['collection_type:custom'];
    if (query) queryParts.push(`title:*${query}*`);
    const result = await shopify.graphql(
      `query listCollections($first: Int!, $query: String) {
        collections(first: $first, query: $query, sortKey: TITLE) {
          nodes {
            id
            title
            productsCount { count }
            ruleSet { rules { column relation condition } }
          }
        }
      }`,
      {first: 50, query: queryParts.join(' ')}
    );
    const collections = (result?.collections?.nodes || []).map(c => ({
      id: c.id,
      title: c.title,
      productsCount: c.productsCount?.count ?? 0,
      smart: !!(c.ruleSet?.rules?.length)
    }));
    res.json({success: true, data: collections});
  } catch (error) {
    const status = error.status || 500;
    console.error('[shopify-products] listCollections error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}
