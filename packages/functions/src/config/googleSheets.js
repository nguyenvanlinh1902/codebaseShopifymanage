/**
 * Google Sheets API Configuration
 */
export const GOOGLE_SHEETS_CONFIG = {
  // OAuth 2.0 scopes
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],

  // Default sheet names for different data types
  defaultSheetNames: {
    products: 'Products',
    orders: 'Orders',
    tracking: 'Tracking'
  },

  // Column mappings for product import
  productColumns: {
    title: 'Title',
    description: 'Description',
    vendor: 'Vendor',
    productType: 'Product Type',
    tags: 'Tags',
    price: 'Price',
    compareAtPrice: 'Compare At Price',
    sku: 'SKU',
    barcode: 'Barcode',
    inventoryQuantity: 'Inventory Quantity',
    imageUrl: 'Image URL',
    status: 'Status',
    storeId: 'Store ID',
    niche: 'Niche'
  },

  // Column mappings for order export
  orderColumns: {
    orderId: 'Order ID',
    orderNumber: 'Order Number',
    email: 'Email',
    customerName: 'Customer Name',
    phone: 'Phone',
    financialStatus: 'Financial Status',
    fulfillmentStatus: 'Fulfillment Status',
    total: 'Total',
    currency: 'Currency',
    lineItems: 'Line Items',
    shippingAddress: 'Shipping Address',
    createdAt: 'Created At',
    storeId: 'Store ID'
  },

  // Column mappings for tracking update
  trackingColumns: {
    orderId: 'Order ID',
    fulfillmentId: 'Fulfillment ID',
    trackingNumber: 'Tracking Number',
    trackingCompany: 'Tracking Company',
    trackingUrl: 'Tracking URL',
    status: 'Status',
    updatedAt: 'Updated At'
  }
};
