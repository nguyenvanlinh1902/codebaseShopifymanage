import shopifyConfig from '../config/shopify.js';

/**
 * Run a ShopifyQL query against a store's Admin GraphQL API.
 * Requires read_analytics + read_reports scopes.
 * @param {string} shopDomain - Store domain (without .myshopify.com)
 * @param {string} accessToken - Shopify access token
 * @param {string} query - ShopifyQL query string
 * @returns {Promise<{tableData: {columns: Array, rows: Array}, parseErrors: Array}>}
 */
export async function runShopifyQL(shopDomain, accessToken, query) {
  const res = await fetch(
    `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `{ shopifyqlQuery(query: ${JSON.stringify(query)}) { tableData { rows columns { name dataType displayName } } parseErrors } }`
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[ShopifyQL] API error ${res.status} for ${shopDomain}:`, errText);
    throw new Error(`Shopify API error: ${res.status}`);
  }

  const json = await res.json();
  if (json?.errors) {
    console.error(`[ShopifyQL] GraphQL errors for ${shopDomain}:`, JSON.stringify(json.errors));
  }
  return json?.data?.shopifyqlQuery;
}
