/**
 * Shopify Collection Products Service — add/remove products and search products.
 * Companion to shopify-collection-service.js.
 */

import {validateGraphqlResult} from '../helpers/graphql-error-handler.js';

/**
 * Add products to a collection (custom collections only).
 */
export async function addProductsToCollection(shopify, collectionId, productIds) {
  const result = await shopify.graphql(`
    mutation($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection { id title productsCount { count } }
        userErrors { field message }
      }
    }
  `, {id: collectionId, productIds});

  validateGraphqlResult(result, 'collectionAddProducts');
  return result.collectionAddProducts.collection;
}

/**
 * Remove products from a collection.
 */
export async function removeProductsFromCollection(shopify, collectionId, productIds) {
  const result = await shopify.graphql(`
    mutation($id: ID!, $productIds: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $productIds) {
        job { id done }
        userErrors { field message }
      }
    }
  `, {id: collectionId, productIds});

  validateGraphqlResult(result, 'collectionRemoveProducts');
  return result.collectionRemoveProducts.job;
}

/**
 * Search Shopify products for product picker (live API, not imported products).
 */
export async function searchShopifyProducts(shopify, {query = '', first = 25, after = null} = {}) {
  const result = await shopify.graphql(`
    query($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id title handle status
          featuredImage { url altText }
          variants(first: 1) { nodes { id sku price } }
        }
      }
    }
  `, {first, after: after || null, query: query || ''});

  return {
    products: result.products.nodes,
    pageInfo: result.products.pageInfo
  };
}
