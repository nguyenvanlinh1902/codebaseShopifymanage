/**
 * Shopify Product Bulk Actions — GraphQL mutations for bulk product operations.
 */

/** Update product status (ACTIVE, DRAFT, ARCHIVED) */
async function updateStatus(shopify, productId, status) {
  await shopify.graphql(
    `mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } userErrors { field message } } }`,
    {input: {id: productId, status}}
  );
}

/** Delete a product */
async function deleteProduct(shopify, productId) {
  await shopify.graphql(
    `mutation productDelete($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { field message } } }`,
    {input: {id: productId}}
  );
}

/** Add tags to a product (merges with existing) */
async function addTags(shopify, productId, tags) {
  await shopify.graphql(
    `mutation tagsAdd($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`,
    {id: productId, tags}
  );
}

/** Remove tags from a product */
async function removeTags(shopify, productId, tags) {
  await shopify.graphql(
    `mutation tagsRemove($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { field message } } }`,
    {id: productId, tags}
  );
}

/** Add products to a collection */
async function addToCollection(shopify, collectionId, productIds) {
  const result = await shopify.graphql(
    `mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection { id productsCount }
        userErrors { field message }
      }
    }`,
    {id: collectionId, productIds}
  );
  const errors = result?.collectionAddProducts?.userErrors || [];
  if (errors.length > 0) throw new Error(errors.map(e => e.message).join(', '));
  return {successCount: productIds.length, failedCount: 0};
}

/** Remove products from a collection */
async function removeFromCollection(shopify, collectionId, productIds) {
  const result = await shopify.graphql(
    `mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
      collectionRemoveProducts(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`,
    {id: collectionId, productIds}
  );
  const errors = result?.collectionRemoveProducts?.userErrors || [];
  if (errors.length > 0) throw new Error(errors.map(e => e.message).join(', '));
  return {successCount: productIds.length, failedCount: 0};
}

const VALID_ACTIONS = ['ACTIVE', 'DRAFT', 'ARCHIVED', 'DELETE', 'ADD_TAGS', 'REMOVE_TAGS', 'ADD_TO_COLLECTION', 'REMOVE_FROM_COLLECTION'];

/**
 * Execute a bulk action on products.
 * @param {Object} shopify - shopify-api-node instance
 * @param {Object} params
 * @param {string[]} params.productIds
 * @param {string} params.action
 * @param {string[]} [params.tags] - for ADD_TAGS / REMOVE_TAGS
 * @param {string} [params.collectionId] - for ADD_TO_COLLECTION / REMOVE_FROM_COLLECTION
 */
export async function executeBulkAction(shopify, {productIds, action, tags, collectionId}) {
  if (!VALID_ACTIONS.includes(action)) throw new Error('Invalid action');

  // Collection actions are batch (single mutation), not per-product
  if (action === 'ADD_TO_COLLECTION') {
    if (!collectionId) throw new Error('collectionId is required');
    return addToCollection(shopify, collectionId, productIds);
  }
  if (action === 'REMOVE_FROM_COLLECTION') {
    if (!collectionId) throw new Error('collectionId is required');
    return removeFromCollection(shopify, collectionId, productIds);
  }

  // Per-product actions
  let successCount = 0;
  let failedCount = 0;

  for (const productId of productIds) {
    try {
      if (action === 'DELETE') await deleteProduct(shopify, productId);
      else if (action === 'ADD_TAGS') await addTags(shopify, productId, tags);
      else if (action === 'REMOVE_TAGS') await removeTags(shopify, productId, tags);
      else await updateStatus(shopify, productId, action);
      successCount++;
    } catch (err) {
      console.error(`[shopify-products] bulk ${action} failed for ${productId}:`, err.message);
      failedCount++;
    }
  }

  return {successCount, failedCount};
}
