/**
 * Collection Controller — CRUD request handlers for Shopify collections.
 * RBAC: admin sees all stores, non-admin sees assigned stores only.
 */

import {StoreRepository} from '../repositories/storeRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {ShopifyService} from '../services/shopifyService.js';
import {extractStoreIds} from '../utils/store-access.js';
import * as collectionSvc from '../services/shopify-collection-service.js';
import * as collectionProductsSvc from '../services/shopify-collection-products-service.js';

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

/**
 * Transform frontend formData into Shopify CollectionInput.
 * Frontend sends: collectionType, rules, disjunctive, image (string), seo.handle, products
 * Shopify expects: ruleSet, image: {src}, seo: {title, description}, handle (top-level)
 */
function buildCollectionInput(formData) {
  const input = {title: formData.title};

  if (formData.descriptionHtml) input.descriptionHtml = formData.descriptionHtml;
  if (formData.templateSuffix) input.templateSuffix = formData.templateSuffix;

  // Handle (from seo.handle, top-level in CollectionInput)
  if (formData.seo?.handle) input.handle = formData.seo.handle;

  // SEO (only title + description, no handle)
  if (formData.seo?.title || formData.seo?.description) {
    input.seo = {};
    if (formData.seo.title) input.seo.title = formData.seo.title;
    if (formData.seo.description) input.seo.description = formData.seo.description;
  }

  // Image — must be {src: url} object, skip base64 data URLs (not supported by Shopify)
  if (formData.image && typeof formData.image === 'string' && !formData.image.startsWith('data:')) {
    input.image = {src: formData.image};
  }

  // Smart collection → ruleSet (not collectionType/rules/disjunctive)
  if (formData.collectionType === 'smart' && formData.rules?.length > 0) {
    input.ruleSet = {
      appliedDisjunctively: formData.disjunctive || false,
      rules: formData.rules.map(r => ({
        column: r.column,
        relation: r.relation,
        condition: r.condition || ''
      }))
    };
  }

  return input;
}

/** GET /api/collections/list */
export async function list(req, res) {
  try {
    const {storeId, query, cursor, first} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionSvc.listCollections(shopify, {
      first: parseInt(first) || 25,
      after: cursor || null,
      query: query || ''
    });
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] list error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** GET /api/collections/:id */
export async function getById(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionSvc.getCollection(shopify, req.params.id);
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] getById error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** POST /api/collections */
export async function create(req, res) {
  try {
    const {storeId, ...formData} = req.body;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const input = buildCollectionInput(formData);
    const data = await collectionSvc.createCollection(shopify, input);

    // For manual collections, add products separately
    if (formData.collectionType === 'manual' && formData.products?.length > 0) {
      const productIds = formData.products.map(p => p.id);
      await collectionProductsSvc.addProductsToCollection(shopify, data.id, productIds);
    }

    // Publish to selected sales channels
    if (formData._publishIds?.length > 0) {
      try {
        await collectionSvc.publishCollection(shopify, data.id, formData._publishIds);
      } catch (pubErr) {
        console.warn('[collection] publish after create failed:', pubErr.message);
      }
    }

    res.status(201).json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] create error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** PUT /api/collections/:id */
export async function update(req, res) {
  try {
    const {storeId, ...formData} = req.body;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const input = buildCollectionInput(formData);
    const data = await collectionSvc.updateCollection(shopify, req.params.id, input);
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] update error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** DELETE /api/collections/:id */
export async function remove(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionSvc.deleteCollection(shopify, req.params.id);
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] remove error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** POST /api/collections/:id/products */
export async function addProducts(req, res) {
  try {
    const {storeId, productIds} = req.body;
    if (!productIds?.length) {
      return res.status(400).json({success: false, error: 'productIds array is required'});
    }
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionProductsSvc.addProductsToCollection(shopify, req.params.id, productIds);
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] addProducts error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** DELETE /api/collections/:id/products */
export async function removeProducts(req, res) {
  try {
    const {storeId, productIds} = req.body;
    if (!productIds?.length) {
      return res.status(400).json({success: false, error: 'productIds array is required'});
    }
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionProductsSvc.removeProductsFromCollection(shopify, req.params.id, productIds);
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] removeProducts error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** POST /api/collections/upload-image — staged upload for collection image */
export async function uploadImage(req, res) {
  try {
    const {storeId, filename, mimeType, fileSize, fileData} = req.body;
    if (!fileData) return res.status(400).json({success: false, error: 'fileData is required'});
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const safeName = filename || 'collection-image.jpg';
    const safeType = mimeType || 'image/jpeg';

    // 1. Get staged upload target (PUT method)
    const target = await collectionSvc.createStagedUpload(shopify, {
      filename: safeName,
      mimeType: safeType,
      fileSize: fileSize || 0
    });

    // 2. POST multipart form to GCS staged target using form-data + node-fetch
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;
    const form = new FormData();

    // Parameters MUST come before the file field
    for (const param of target.parameters) {
      form.append(param.name, param.value);
    }
    form.append('file', buffer, {filename: safeName, contentType: safeType});

    const uploadRes = await fetch(target.url, {method: 'POST', body: form, headers: form.getHeaders()});
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Staged upload failed: ${uploadRes.status} ${text}`);
    }

    // 3. Register file with Shopify to get permanent URL
    const file = await collectionSvc.createFileFromStagedUpload(shopify, {
      originalSource: target.resourceUrl,
      filename: safeName
    });

    // File image URL may take a moment to process; use resourceUrl as fallback
    const imageUrl = file?.image?.url || target.resourceUrl;
    res.json({success: true, data: {url: imageUrl}});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] uploadImage error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** GET /api/collections/publications — list sales channels for a store */
export async function getPublications(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionSvc.listPublications(shopify);
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] getPublications error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** GET /api/collections/:id/publications — which channels a collection is published to */
export async function getCollectionPublications(req, res) {
  try {
    const {storeId} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionSvc.getCollectionPublications(shopify, req.params.id);
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] getCollectionPublications error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** PUT /api/collections/:id/publish — publish/unpublish to channels */
export async function updatePublishing(req, res) {
  try {
    const {storeId, publishIds, unpublishIds} = req.body;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    if (publishIds?.length) await collectionSvc.publishCollection(shopify, req.params.id, publishIds);
    if (unpublishIds?.length) await collectionSvc.unpublishCollection(shopify, req.params.id, unpublishIds);
    res.json({success: true});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] updatePublishing error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}

/** GET /api/collections/search-products */
export async function searchProducts(req, res) {
  try {
    const {storeId, query, cursor, first} = req.query;
    await validateStoreAccess(req, storeId);
    const shopify = await getShopify(storeId);
    const data = await collectionProductsSvc.searchShopifyProducts(shopify, {
      query: query || '',
      first: parseInt(first) || 25,
      after: cursor || null
    });
    res.json({success: true, data});
  } catch (error) {
    const status = error.status || 500;
    console.error('[collection] searchProducts error:', error.message);
    res.status(status).json({success: false, error: error.message});
  }
}
