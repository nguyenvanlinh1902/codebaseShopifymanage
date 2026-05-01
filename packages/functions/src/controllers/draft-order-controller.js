/**
 * Draft Order Controller — create draft orders via Shopify GraphQL Admin API.
 */
import {shopifyGraphQL, validateStoreAccess} from '../helpers/shopify-admin-graphql.js';

const SEARCH_PRODUCTS_QUERY = `
query SearchProducts($query: String!, $first: Int!) {
  products(query: $query, first: $first) {
    edges {
      node {
        id
        title
        status
        featuredImage { url }
        variants(first: 20) {
          edges {
            node {
              id
              title
              sku
              price
              inventoryQuantity
              image { url }
            }
          }
        }
      }
    }
  }
}`;

/**
 * GET /api/draft-orders/products?storeId=xxx&query=...
 * Search products for line item selection.
 */
export async function searchProducts(req, res) {
  try {
    const {storeId, query} = req.query;
    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const access = await validateStoreAccess(req, storeId);
    if (access.error) return res.status(access.status).json({success: false, error: access.error});

    const searchQuery = String(query || '').replace(/[\\"/]/g, ' ').trim();
    // Empty query returns recent active products
    const gqlQuery = searchQuery || 'status:active';

    const data = await shopifyGraphQL(access.store, SEARCH_PRODUCTS_QUERY, {
      query: gqlQuery,
      first: 10
    });

    const products = (data.products?.edges || []).map(({node}) => ({
      id: node.id,
      title: node.title,
      status: node.status,
      image: node.featuredImage?.url || null,
      variants: (node.variants?.edges || []).map(({node: v}) => ({
        id: v.id,
        title: v.title,
        sku: v.sku || '',
        price: v.price,
        inventoryQuantity: v.inventoryQuantity,
        image: v.image?.url || null
      }))
    }));

    return res.json({success: true, data: {products}});
  } catch (error) {
    console.error('Search products error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

const DRAFT_ORDER_CREATE_MUTATION = `
mutation DraftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id
      name
      invoiceUrl
      status
      totalPriceSet { shopMoney { amount currencyCode } }
      createdAt
    }
    userErrors {
      field
      message
    }
  }
}`;

/**
 * POST /api/draft-orders
 * Body: { storeId, lineItems, customer, note, tags, shippingAddress, appliedDiscount }
 *
 * lineItems: [{ variantId, quantity }] or [{ title, originalUnitPrice, quantity }] for custom items
 * customer: { email, firstName, lastName, phone } (optional)
 * shippingAddress: { address1, address2, city, province, country, zip, phone } (optional)
 * appliedDiscount: { value, valueType: 'FIXED_AMOUNT' | 'PERCENTAGE', title } (optional)
 */
export async function createDraftOrder(req, res) {
  try {
    const {storeId, lineItems, customer, note, tags, shippingAddress, appliedDiscount, shippingLine, taxExempt} = req.body || {};

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({success: false, error: 'At least one line item is required'});
    }

    const access = await validateStoreAccess(req, storeId);
    if (access.error) return res.status(access.status).json({success: false, error: access.error});

    // Build draft order input
    const input = {
      lineItems: lineItems.map(item => {
        const lineItem = item.variantId
          ? {variantId: item.variantId, quantity: parseInt(item.quantity, 10) || 1}
          : {
              title: item.title || 'Custom Item',
              originalUnitPrice: String(item.originalUnitPrice || '0'),
              quantity: parseInt(item.quantity, 10) || 1
            };
        if (item.customAttributes?.length) {
          lineItem.customAttributes = item.customAttributes.map(a => ({
            key: a.key,
            value: String(a.value ?? '')
          }));
        }
        return lineItem;
      })
    };

    if (note) input.note = note;
    if (tags && tags.length > 0) input.tags = Array.isArray(tags) ? tags : [tags];

    if (customer?.email) {
      input.email = customer.email;
    }

    if (shippingAddress) {
      input.shippingAddress = {
        address1: shippingAddress.address1 || '',
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city || '',
        province: shippingAddress.province || '',
        country: shippingAddress.country || '',
        zip: shippingAddress.zip || '',
        phone: shippingAddress.phone || '',
        firstName: shippingAddress.firstName || customer?.firstName || '',
        lastName: shippingAddress.lastName || customer?.lastName || ''
      };
    }

    if (appliedDiscount && parseFloat(appliedDiscount.value) > 0) {
      input.appliedDiscount = {
        value: parseFloat(appliedDiscount.value) || 0,
        valueType: appliedDiscount.valueType || 'FIXED_AMOUNT',
        title: appliedDiscount.title || 'Discount'
      };
    }

    if (shippingLine && parseFloat(shippingLine.price) > 0) {
      input.shippingLine = {
        title: shippingLine.title || 'Shipping',
        price: String(shippingLine.price)
      };
    }

    if (taxExempt !== undefined) {
      input.taxExempt = !!taxExempt;
    }

    const data = await shopifyGraphQL(access.store, DRAFT_ORDER_CREATE_MUTATION, {input});

    const userErrors = data.draftOrderCreate?.userErrors || [];
    if (userErrors.length > 0) {
      return res.status(422).json({success: false, error: userErrors[0].message, details: userErrors});
    }

    const draftOrder = data.draftOrderCreate?.draftOrder;
    const numericId = draftOrder.id.split('/').pop();

    return res.json({
      success: true,
      data: {
        id: draftOrder.id,
        name: draftOrder.name,
        invoiceUrl: draftOrder.invoiceUrl,
        status: draftOrder.status,
        total: draftOrder.totalPriceSet?.shopMoney?.amount || '0.00',
        currency: draftOrder.totalPriceSet?.shopMoney?.currencyCode || 'USD',
        createdAt: draftOrder.createdAt,
        adminUrl: `https://${access.store.shopDomain}.myshopify.com/admin/draft_orders/${numericId}`
      }
    });
  } catch (error) {
    console.error('Create draft order error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

const LIST_DRAFT_ORDERS_QUERY = `
query ListDraftOrders($first: Int!, $after: String, $query: String) {
  draftOrders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
    edges {
      node {
        id
        name
        status
        createdAt
        updatedAt
        invoiceUrl
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { firstName lastName email }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

/**
 * GET /api/draft-orders?storeId=xxx&cursor=...
 * List draft orders for a store.
 */
export async function listDraftOrders(req, res) {
  try {
    const {storeId, cursor, query} = req.query;
    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const access = await validateStoreAccess(req, storeId);
    if (access.error) return res.status(access.status).json({success: false, error: access.error});

    const data = await shopifyGraphQL(access.store, LIST_DRAFT_ORDERS_QUERY, {
      first: 10,
      after: cursor || null,
      query: query || null
    });

    const draftOrders = (data.draftOrders?.edges || []).map(({node}) => {
      const numericId = node.id.split('/').pop();
      return {
        id: node.id,
        name: node.name,
        status: node.status,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        invoiceUrl: node.invoiceUrl,
        total: node.totalPriceSet?.shopMoney?.amount || '0.00',
        currency: node.totalPriceSet?.shopMoney?.currencyCode || 'USD',
        customer: node.customer
          ? {
              name: [node.customer.firstName, node.customer.lastName].filter(Boolean).join(' ') || 'N/A',
              email: node.customer.email || ''
            }
          : null,
        adminUrl: `https://${access.store.shopDomain}.myshopify.com/admin/draft_orders/${numericId}`
      };
    });

    return res.json({
      success: true,
      data: {
        draftOrders,
        pageInfo: data.draftOrders?.pageInfo || {hasNextPage: false, endCursor: null}
      }
    });
  } catch (error) {
    console.error('List draft orders error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

const GET_DRAFT_ORDER_QUERY = `
query GetDraftOrder($id: ID!) {
  draftOrder(id: $id) {
    id
    name
    status
    note2
    tags
    email
    invoiceUrl
    createdAt
    totalPriceSet { shopMoney { amount currencyCode } }
    subtotalPriceSet { shopMoney { amount currencyCode } }
    totalTax
    taxExempt
    appliedDiscount { title value valueType }
    shippingLine { title originalPriceSet { shopMoney { amount } } }
    customer { firstName lastName email phone }
    shippingAddress { address1 city province country zip phone firstName lastName }
    lineItems(first: 50) {
      edges {
        node {
          id
          title
          quantity
          variant { id title sku price image { url } }
          originalUnitPriceSet { shopMoney { amount } }
          image { url }
          custom
        }
      }
    }
  }
}`;

/**
 * GET /api/draft-orders/:id?storeId=xxx
 * Fetch a single draft order for editing.
 */
export async function getDraftOrder(req, res) {
  try {
    const {storeId} = req.query;
    const draftOrderId = req.params.id;
    if (!storeId || !draftOrderId) {
      return res.status(400).json({success: false, error: 'storeId and id are required'});
    }

    const access = await validateStoreAccess(req, storeId);
    if (access.error) return res.status(access.status).json({success: false, error: access.error});

    const gid = draftOrderId.startsWith('gid://') ? draftOrderId : `gid://shopify/DraftOrder/${draftOrderId}`;
    const data = await shopifyGraphQL(access.store, GET_DRAFT_ORDER_QUERY, {id: gid});

    const d = data.draftOrder;
    if (!d) return res.status(404).json({success: false, error: 'Draft order not found'});

    const numericId = d.id.split('/').pop();
    const result = {
      id: d.id,
      name: d.name,
      status: d.status,
      note: d.note2 || '',
      tags: d.tags || [],
      email: d.email || '',
      invoiceUrl: d.invoiceUrl,
      createdAt: d.createdAt,
      total: d.totalPriceSet?.shopMoney?.amount || '0.00',
      subtotal: d.subtotalPriceSet?.shopMoney?.amount || '0.00',
      currency: d.totalPriceSet?.shopMoney?.currencyCode || 'USD',
      totalTax: d.totalTax || '0.00',
      taxExempt: d.taxExempt || false,
      appliedDiscount: d.appliedDiscount || null,
      shippingLine: d.shippingLine ? {
        title: d.shippingLine.title,
        price: d.shippingLine.originalPriceSet?.shopMoney?.amount || '0.00'
      } : null,
      customer: d.customer ? {
        name: [d.customer.firstName, d.customer.lastName].filter(Boolean).join(' ') || '',
        email: d.customer.email || '',
        phone: d.customer.phone || ''
      } : null,
      shippingAddress: d.shippingAddress || null,
      lineItems: (d.lineItems?.edges || []).map(({node}) => ({
        id: node.id,
        title: node.title,
        quantity: node.quantity,
        isCustom: node.custom,
        price: node.variant?.price || node.originalUnitPriceSet?.shopMoney?.amount || '0',
        variantId: node.variant?.id || '',
        variantTitle: node.variant?.title !== 'Default Title' ? (node.variant?.title || '') : '',
        sku: node.variant?.sku || '',
        image: node.variant?.image?.url || node.image?.url || null
      })),
      adminUrl: `https://${access.store.shopDomain}.myshopify.com/admin/draft_orders/${numericId}`
    };

    return res.json({success: true, data: result});
  } catch (error) {
    console.error('Get draft order error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

const DRAFT_ORDER_UPDATE_MUTATION = `
mutation DraftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
  draftOrderUpdate(id: $id, input: $input) {
    draftOrder {
      id
      name
      invoiceUrl
      status
      totalPriceSet { shopMoney { amount currencyCode } }
    }
    userErrors { field message }
  }
}`;

/**
 * PUT /api/draft-orders/:id
 * Body: { storeId, lineItems, customer, note, tags }
 */
export async function updateDraftOrder(req, res) {
  try {
    const draftOrderId = req.params.id;
    const {storeId, lineItems, customer, note, tags, appliedDiscount, shippingLine, taxExempt, shippingAddress} = req.body || {};

    if (!storeId || !draftOrderId) {
      return res.status(400).json({success: false, error: 'storeId and id are required'});
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({success: false, error: 'At least one line item is required'});
    }

    const access = await validateStoreAccess(req, storeId);
    if (access.error) return res.status(access.status).json({success: false, error: access.error});

    const gid = draftOrderId.startsWith('gid://') ? draftOrderId : `gid://shopify/DraftOrder/${draftOrderId}`;

    const input = {
      lineItems: lineItems.map(item => {
        const lineItem = item.variantId
          ? {variantId: item.variantId, quantity: parseInt(item.quantity, 10) || 1}
          : {
              title: item.title || 'Custom Item',
              originalUnitPrice: String(item.originalUnitPrice || '0'),
              quantity: parseInt(item.quantity, 10) || 1
            };
        if (item.customAttributes?.length) {
          lineItem.customAttributes = item.customAttributes.map(a => ({
            key: a.key,
            value: String(a.value ?? '')
          }));
        }
        return lineItem;
      })
    };

    if (note !== undefined) input.note = note;
    if (tags) input.tags = Array.isArray(tags) ? tags : [tags];
    if (customer?.email) input.email = customer.email;

    if (shippingAddress) {
      input.shippingAddress = {
        address1: shippingAddress.address1 || '',
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city || '',
        province: shippingAddress.province || '',
        country: shippingAddress.country || '',
        zip: shippingAddress.zip || '',
        phone: shippingAddress.phone || '',
        firstName: shippingAddress.firstName || customer?.firstName || '',
        lastName: shippingAddress.lastName || customer?.lastName || ''
      };
    }

    if (appliedDiscount && parseFloat(appliedDiscount.value) > 0) {
      input.appliedDiscount = {
        value: parseFloat(appliedDiscount.value) || 0,
        valueType: appliedDiscount.valueType || 'FIXED_AMOUNT',
        title: appliedDiscount.title || 'Discount'
      };
    }

    if (shippingLine && parseFloat(shippingLine.price) > 0) {
      input.shippingLine = {
        title: shippingLine.title || 'Shipping',
        price: String(shippingLine.price)
      };
    }

    if (taxExempt !== undefined) {
      input.taxExempt = !!taxExempt;
    }

    const data = await shopifyGraphQL(access.store, DRAFT_ORDER_UPDATE_MUTATION, {id: gid, input});

    const userErrors = data.draftOrderUpdate?.userErrors || [];
    if (userErrors.length > 0) {
      return res.status(422).json({success: false, error: userErrors[0].message, details: userErrors});
    }

    const draftOrder = data.draftOrderUpdate?.draftOrder;
    const numericId = draftOrder.id.split('/').pop();

    return res.json({
      success: true,
      data: {
        id: draftOrder.id,
        name: draftOrder.name,
        invoiceUrl: draftOrder.invoiceUrl,
        status: draftOrder.status,
        total: draftOrder.totalPriceSet?.shopMoney?.amount || '0.00',
        currency: draftOrder.totalPriceSet?.shopMoney?.currencyCode || 'USD',
        adminUrl: `https://${access.store.shopDomain}.myshopify.com/admin/draft_orders/${numericId}`
      }
    });
  } catch (error) {
    console.error('Update draft order error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/draft-orders/customers?storeId=xxx&query=...
 * Search customers via Shopify GraphQL Admin API.
 * Requires: read_customers scope + Protected Customer Data approval on the store.
 * To enable: Partner Dashboard → App → API access → Protected customer data → Request access
 */
const SEARCH_CUSTOMERS_QUERY = `
query SearchCustomers($query: String!, $first: Int!) {
  customers(query: $query, first: $first, sortKey: UPDATED_AT, reverse: true) {
    edges {
      node {
        id
        firstName
        lastName
        email
        phone
        numberOfOrders
        defaultAddress { address1 city province country zip }
      }
    }
  }
}`;

export async function searchCustomers(req, res) {
  try {
    const {storeId, query} = req.query;
    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const access = await validateStoreAccess(req, storeId);
    if (access.error) return res.status(access.status).json({success: false, error: access.error});

    const searchQuery = String(query || '').replace(/[\\"/]/g, ' ').trim();
    const gqlQuery = searchQuery || '*';

    const data = await shopifyGraphQL(access.store, SEARCH_CUSTOMERS_QUERY, {
      query: gqlQuery,
      first: 10
    });

    const customers = (data.customers?.edges || []).map(({node}) => ({
      id: node.id,
      name: [node.firstName, node.lastName].filter(Boolean).join(' ') || 'No name',
      email: node.email || '',
      phone: node.phone || '',
      ordersCount: parseInt(node.numberOfOrders, 10) || 0,
      address: node.defaultAddress
        ? [node.defaultAddress.address1, node.defaultAddress.city, node.defaultAddress.province, node.defaultAddress.country]
            .filter(Boolean).join(', ')
        : ''
    }));

    return res.json({success: true, data: {customers}});
  } catch (error) {
    console.error('Search customers error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

