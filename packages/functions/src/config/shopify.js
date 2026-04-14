const shopifyConfig = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecret: process.env.SHOPIFY_API_SECRET,
  appUrl: process.env.APP_URL,
  scopes:
    process.env.SHOPIFY_SCOPES ||
    'read_products,write_products,read_orders,write_orders,read_all_orders,read_fulfillments,write_fulfillments,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders,read_third_party_fulfillment_orders,write_third_party_fulfillment_orders,read_inventory,write_inventory,read_themes,write_themes,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions,read_customers,write_customers,read_draft_orders,write_draft_orders,read_shopify_payments_disputes,read_shopify_payments_payouts,read_shopify_payments_accounts,read_legal_policies,write_legal_policies,read_analytics,read_reports,read_publications,write_publications,read_files,write_files,read_shipping,write_shipping',
  apiVersion: '2026-04'
};

export default shopifyConfig;
