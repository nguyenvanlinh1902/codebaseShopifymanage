/**
 * Shopify Product List Service — fetch products via GraphQL Admin API.
 */

/**
 * List products with cursor-based pagination.
 */
export async function listShopifyProducts(
  shopify,
  {first = 50, after = null, query = '', sortKey = 'TITLE', reverse = false} = {}
) {
  const result = await shopify.graphql(
    `
    query($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
      products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
        pageInfo { hasNextPage hasPreviousPage endCursor startCursor }
        nodes {
          id title handle status vendor productType totalInventory
          featuredImage { url }
          variants(first: 3) {
            nodes { id sku price inventoryQuantity }
          }
          variantsCount { count }
        }
      }
    }
  `,
    {first, after: after || null, query: query || null, sortKey, reverse}
  );

  return {
    products: result.products.nodes,
    pageInfo: result.products.pageInfo
  };
}
