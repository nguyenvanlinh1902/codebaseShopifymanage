/**
 * Shopify Product Bulk Actions — optimized with aliased GraphQL mutations.
 * Instead of N separate API calls, batches multiple mutations into a single
 * GraphQL request using aliases (e.g., p0: tagsAdd(...), p1: tagsAdd(...)).
 * Shopify cost limit ~1000 points/request, each mutation ~10 points → max ~100 per request.
 * We use batches of 50 to stay safe.
 */

const BATCH_SIZE = 50;

/**
 * Build and execute an aliased GraphQL mutation for multiple products.
 * @param {Object} shopify
 * @param {string[]} productIds
 * @param {function} buildMutation - (alias, productId) => {fragment, vars}
 * @returns {{successCount, failedCount}}
 */
async function runAliasedMutations(shopify, productIds, buildMutation) {
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);
    const fragments = [];
    const varDefs = [];
    const variables = {};

    batch.forEach((pid, idx) => {
      const alias = `p${idx}`;
      const built = buildMutation(alias, pid);
      fragments.push(built.fragment);
      varDefs.push(...built.varDefs);
      Object.assign(variables, built.vars);
    });

    const query = `mutation BulkAction(${varDefs.join(', ')}) {\n${fragments.join('\n')}\n}`;

    try {
      const result = await shopify.graphql(query, variables);
      // Check each alias result for userErrors
      batch.forEach((_, idx) => {
        const alias = `p${idx}`;
        const entry = result?.[alias];
        const errors = entry?.userErrors || [];
        if (errors.length > 0) {
          console.error(`[bulk] ${alias} userErrors:`, JSON.stringify(errors));
          failedCount++;
        } else {
          successCount++;
        }
      });
    } catch (err) {
      console.error('[bulk] aliased mutation error:', err.message);
      failedCount += batch.length;
    }
  }

  return {successCount, failedCount};
}

// ── Aliased mutation builders ────────────────────────────────────────────────

function buildStatusUpdate(status) {
  return (alias, productId) => ({
    fragment: `  ${alias}: productUpdate(product: {id: "${productId}", status: ${status}}) { product { id } userErrors { field message } }`,
    varDefs: [],
    vars: {}
  });
}

function buildDelete() {
  return (alias, productId) => ({
    fragment: `  ${alias}: productDelete(input: {id: "${productId}"}) { deletedProductId userErrors { field message } }`,
    varDefs: [],
    vars: {}
  });
}

function buildTagsAdd(tags) {
  // Tags are shared across all aliases — use a single variable
  return (alias, productId) => ({
    fragment: `  ${alias}: tagsAdd(id: "${productId}", tags: $tags) { node { id } userErrors { message } }`,
    varDefs: ['$tags: [String!]!'],
    vars: {tags}
  });
}

function buildTagsRemove(tags) {
  return (alias, productId) => ({
    fragment: `  ${alias}: tagsRemove(id: "${productId}", tags: $tags) { node { id } userErrors { message } }`,
    varDefs: ['$tags: [String!]!'],
    vars: {tags}
  });
}

// ── Collection actions (already batch by nature) ─────────────────────────────

async function getExistingProductIds(shopify, collectionId, productIds) {
  const existing = new Set();
  let cursor = null;
  do {
    const result = await shopify.graphql(
      `query CollectionProducts($id: ID!, $after: String) {
        collection(id: $id) {
          products(first: 250, after: $after) {
            nodes { id }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      {id: collectionId, after: cursor}
    );
    const products = result?.collection?.products;
    for (const p of (products?.nodes || [])) existing.add(p.id);
    cursor = products?.pageInfo?.hasNextPage ? products.pageInfo.endCursor : null;
  } while (cursor);
  return productIds.filter(id => existing.has(id));
}

async function addToCollection(shopify, collectionId, productIds) {
  const alreadyIn = await getExistingProductIds(shopify, collectionId, productIds);
  const skippedCount = alreadyIn.length;
  const toAdd = productIds.filter(id => !alreadyIn.includes(id));
  if (toAdd.length === 0) return {successCount: 0, failedCount: 0, skippedCount};

  let successCount = 0;
  let failedCount = 0;
  for (let i = 0; i < toAdd.length; i += 250) {
    const batch = toAdd.slice(i, i + 250);
    try {
      const result = await shopify.graphql(
        `mutation AddToCollection($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) {
            collection { id }
            userErrors { field message }
          }
        }`,
        {id: collectionId, productIds: batch}
      );
      const errors = result?.collectionAddProducts?.userErrors || [];
      if (errors.length > 0) {
        console.error('[bulk] collectionAddProducts userErrors:', JSON.stringify(errors));
        failedCount += batch.length;
      } else {
        successCount += batch.length;
      }
    } catch (err) {
      console.error('[bulk] collectionAddProducts error:', err.message);
      failedCount += batch.length;
    }
  }
  return {successCount, failedCount, skippedCount};
}

async function removeFromCollection(shopify, collectionId, productIds) {
  let successCount = 0;
  let failedCount = 0;
  for (let i = 0; i < productIds.length; i += 250) {
    const batch = productIds.slice(i, i + 250);
    try {
      const result = await shopify.graphql(
        `mutation RemoveFromCollection($id: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $id, productIds: $productIds) {
            job { id done }
            userErrors { field message }
          }
        }`,
        {id: collectionId, productIds: batch}
      );
      const errors = result?.collectionRemoveProducts?.userErrors || [];
      if (errors.length > 0) {
        console.error('[bulk] collectionRemoveProducts userErrors:', JSON.stringify(errors));
        failedCount += batch.length;
      } else {
        successCount += batch.length;
      }
    } catch (err) {
      console.error('[bulk] collectionRemoveProducts error:', err.message);
      failedCount += batch.length;
    }
  }
  return {successCount, failedCount};
}

// ── Main entry point ─────────────────────────────────────────────────────────

const VALID_ACTIONS = [
  'ACTIVE', 'DRAFT', 'ARCHIVED', 'DELETE',
  'ADD_TAGS', 'REMOVE_TAGS',
  'ADD_TO_COLLECTION', 'REMOVE_FROM_COLLECTION'
];

/**
 * Execute a bulk action on products — optimized with aliased mutations.
 *
 * Performance comparison (50 products):
 * - Old: 50 sequential API calls → ~25-50s
 * - New: 1 aliased GraphQL request → ~1-2s
 */
export async function executeBulkAction(shopify, {productIds, action, tags, collectionId}) {
  if (!VALID_ACTIONS.includes(action)) throw new Error('Invalid action');

  if (action === 'ADD_TO_COLLECTION') {
    if (!collectionId) throw new Error('collectionId is required');
    return addToCollection(shopify, collectionId, productIds);
  }
  if (action === 'REMOVE_FROM_COLLECTION') {
    if (!collectionId) throw new Error('collectionId is required');
    return removeFromCollection(shopify, collectionId, productIds);
  }

  // Aliased mutations — all products in 1 GraphQL request
  const builders = {
    ACTIVE: buildStatusUpdate('ACTIVE'),
    DRAFT: buildStatusUpdate('DRAFT'),
    ARCHIVED: buildStatusUpdate('ARCHIVED'),
    DELETE: buildDelete(),
    ADD_TAGS: buildTagsAdd(tags),
    REMOVE_TAGS: buildTagsRemove(tags)
  };

  return runAliasedMutations(shopify, productIds, builders[action]);
}
