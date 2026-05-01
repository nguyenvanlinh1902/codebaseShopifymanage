/**
 * Shared Shopify Admin GraphQL helper.
 * Used by all controllers that talk to a store's Admin API.
 *
 * Features:
 * - 1-time retry on THROTTLED / 429
 * - Validates store access by user role + assigned stores
 */

import {StoreRepository} from '../repositories/storeRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {hasStoreAccess} from '../utils/store-access.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();
const adminUserRepo = new AdminUserRepository();

const RETRY_DELAY_MS = 1500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Make a GraphQL request to a store's Admin API.
 * Retries once on throttle (429 or extensions THROTTLED).
 */
export async function shopifyGraphQL(store, query, variables = {}, attempt = 0) {
  const res = await fetch(
    `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({query, variables})
    }
  );

  if (res.status === 429 && attempt === 0) {
    await sleep(RETRY_DELAY_MS);
    return shopifyGraphQL(store, query, variables, attempt + 1);
  }
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[ShopifyGraphQL] ${res.status} (${store.shopDomain}):`, errText);
    throw new Error(`Shopify API error ${res.status}`);
  }

  const json = await res.json();
  const isThrottled = (json?.errors || []).some(
    e => e.extensions?.code === 'THROTTLED' || /throttle/i.test(e.message || '')
  );
  if (isThrottled && attempt === 0) {
    await sleep(RETRY_DELAY_MS);
    return shopifyGraphQL(store, query, variables, attempt + 1);
  }
  if (json?.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }
  return json.data;
}

/**
 * Validate the request user has access to the store.
 * Returns {store} on success or {error, status} on failure.
 */
export async function validateStoreAccess(req, storeId) {
  const store = await storeRepo.getById(storeId);
  if (!store?.accessToken) {
    return {error: 'Store not found or no access token', status: 404};
  }
  if (req.userRole !== 'admin') {
    const userRecord = await adminUserRepo.getById(req.userId);
    if (!hasStoreAccess(userRecord?.assignedStores, storeId)) {
      return {error: 'Access denied to this store', status: 403};
    }
  }
  return {store};
}
