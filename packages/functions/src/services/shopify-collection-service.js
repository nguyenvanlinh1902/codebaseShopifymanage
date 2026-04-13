/**
 * Shopify Collection Service — CRUD operations via GraphQL Admin API.
 * Handles list, get, create, update, delete for collections.
 */

import {validateGraphqlResult} from '../helpers/graphql-error-handler.js';

const COLLECTION_FIELDS = `
  id title handle description descriptionHtml
  image { url altText }
  productsCount { count }
  ruleSet { appliedDisjunctively rules { column relation condition } }
  seo { title description }
  templateSuffix
  updatedAt
`;

/**
 * List collections with cursor-based pagination.
 */
export async function listCollections(shopify, {first = 25, after = null, query = ''} = {}) {
  const result = await shopify.graphql(`
    query($first: Int!, $after: String, $query: String) {
      collections(first: $first, after: $after, query: $query) {
        pageInfo { hasNextPage hasPreviousPage endCursor startCursor }
        nodes {
          id title handle description
          image { url altText }
          productsCount { count }
          ruleSet { appliedDisjunctively rules { column relation condition } }
          updatedAt
        }
      }
    }
  `, {first, after: after || null, query: query || null});

  return {
    collections: result.collections.nodes.map(c => ({
      ...c,
      type: c.ruleSet ? 'smart' : 'custom',
      productsCount: c.productsCount?.count || 0
    })),
    pageInfo: result.collections.pageInfo
  };
}

/**
 * Get a single collection by GID with first 50 products.
 */
export async function getCollection(shopify, id) {
  const result = await shopify.graphql(`
    query($id: ID!) {
      collection(id: $id) {
        ${COLLECTION_FIELDS}
        products(first: 50) {
          nodes { id title handle featuredImage { url altText } }
        }
      }
    }
  `, {id});

  if (!result.collection) throw new Error(`Collection ${id} not found`);
  const c = result.collection;
  return {
    ...c,
    type: c.ruleSet ? 'smart' : 'custom',
    productsCount: c.productsCount?.count || 0,
    products: c.products?.nodes || []
  };
}

/**
 * Create a collection (custom or smart via ruleSet).
 */
export async function createCollection(shopify, input) {
  const result = await shopify.graphql(`
    mutation($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          ${COLLECTION_FIELDS}
        }
        userErrors { field message }
      }
    }
  `, {input});

  validateGraphqlResult(result, 'collectionCreate');
  const c = result.collectionCreate.collection;
  return {
    ...c,
    type: c.ruleSet ? 'smart' : 'custom',
    productsCount: c.productsCount?.count || 0
  };
}

/**
 * Update a collection by GID.
 */
export async function updateCollection(shopify, id, input) {
  const result = await shopify.graphql(`
    mutation($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection {
          ${COLLECTION_FIELDS}
        }
        userErrors { field message }
      }
    }
  `, {input: {id, ...input}});

  validateGraphqlResult(result, 'collectionUpdate');
  const c = result.collectionUpdate.collection;
  return {
    ...c,
    type: c.ruleSet ? 'smart' : 'custom',
    productsCount: c.productsCount?.count || 0
  };
}

/**
 * Create a staged upload target for a collection image.
 * Uses PUT method for simpler upload flow.
 */
export async function createStagedUpload(shopify, {filename, mimeType, fileSize}) {
  const result = await shopify.graphql(`
    mutation($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `, {
    input: [{
      filename,
      mimeType,
      httpMethod: 'POST',
      resource: 'IMAGE',
      fileSize: String(fileSize)
    }]
  });

  validateGraphqlResult(result, 'stagedUploadsCreate');
  const target = result.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error('No staged upload target returned');
  return target;
}

/**
 * Register an uploaded file with Shopify via fileCreate, returns the permanent image URL.
 */
export async function createFileFromStagedUpload(shopify, {originalSource, filename}) {
  const result = await shopify.graphql(`
    mutation($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage {
            id
            image { url }
          }
        }
        userErrors { field message }
      }
    }
  `, {
    files: [{
      originalSource,
      filename,
      contentType: 'IMAGE'
    }]
  });

  validateGraphqlResult(result, 'fileCreate');
  return result.fileCreate.files[0];
}

/**
 * Delete a collection by GID.
 */
export async function deleteCollection(shopify, id) {
  const result = await shopify.graphql(`
    mutation($input: CollectionDeleteInput!) {
      collectionDelete(input: $input) {
        deletedCollectionId
        userErrors { field message }
      }
    }
  `, {input: {id}});

  validateGraphqlResult(result, 'collectionDelete');
  return {deletedId: result.collectionDelete.deletedCollectionId};
}
