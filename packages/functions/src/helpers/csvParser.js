/**
 * CSV Parser Helper
 * Parses CSV files for product import
 * Supports FULL Shopify export format with all columns
 */

/**
 * Parse CSV string to array of objects
 * Properly handles multi-line fields (newlines inside quotes)
 */
export function parseCsv(csvString) {
  // Remove UTF-8 BOM if present (common in Excel exports)
  const cleanedString = csvString.replace(/^\uFEFF/, '');

  // Parse all rows (handles multi-line fields)
  const rows = parseAllRows(cleanedString);

  if (rows.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  // Parse header
  const headers = rows[0];

  // Parse data rows
  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (row.length === 0 || row.every(cell => !cell)) {
      continue;
    }

    // Create product object
    const product = {};
    headers.forEach((header, index) => {
      product[header.trim()] = row[index] ? row[index].trim() : '';
    });

    products.push(product);
  }

  return products;
}

/**
 * Parse all rows from CSV string
 * Handles multi-line fields (newlines inside quoted fields)
 */
function parseAllRows(csvString) {
  const rows = [];
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote (two quotes in a row)
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of cell
      cells.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row
      // Skip \r\n or \n\r combinations
      if ((char === '\r' && nextChar === '\n') || (char === '\n' && nextChar === '\r')) {
        i++; // Skip next newline character
      }

      // Add last cell to row
      cells.push(current);
      current = '';

      // Add row to result (skip empty rows)
      if (cells.length > 0 && !cells.every(c => !c)) {
        rows.push([...cells]);
      }
      cells.length = 0;
    } else {
      // Regular character (including newlines inside quotes)
      current += char;
    }
  }

  // Add last cell and row if not empty
  if (current || cells.length > 0) {
    cells.push(current);
    if (cells.length > 0 && !cells.every(c => !c)) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * Validate required product fields
 * Supports both Shopify export format and simplified format
 */
export function validateProductData(product) {
  const errors = [];

  // Required fields - check both old and new format variations
  const title = product.Title || product.title;
  if (!title || !title.trim()) {
    errors.push('Title is required');
  }

  // Optional but validated fields - support both old and new column names
  const price = product['Variant Price'] || product.Price || product.price || product.variant_price;
  if (price && isNaN(parseFloat(price))) {
    errors.push('Price must be a valid number');
  }

  const compareAtPrice =
    product['Variant Compare At Price'] ||
    product['Compare-at price'] ||
    product.compare_at_price ||
    product.compareAtPrice;
  if (compareAtPrice && isNaN(parseFloat(compareAtPrice))) {
    errors.push('Compare at price must be a valid number');
  }

  const inventoryQty =
    product['Variant Inventory Qty'] ||
    product['Inventory quantity'] ||
    product.inventory_quantity ||
    product.inventoryQuantity;
  if (inventoryQty && isNaN(parseInt(inventoryQty))) {
    errors.push('Inventory quantity must be a valid integer');
  }

  return errors;
}

/**
 * Helper: Parse boolean field (handles TRUE, True, true, 1, yes, etc.)
 */
function parseBoolean(value, defaultValue = true) {
  if (!value || value === '') return defaultValue;
  const lower = value.toString().toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'y';
}

/**
 * Helper: Parse inventory policy (handles both old "deny"/"continue" and new "DENY"/"CONTINUE" format)
 */
function parseInventoryPolicy(value) {
  if (!value || value === '') return 'deny';
  const lower = value.toString().toLowerCase();
  if (lower === 'continue' || lower === 'true' || lower === '1' || lower === 'yes') {
    return 'continue';
  }
  return 'deny';
}

/**
 * Helper: Get field value with multiple possible names
 */
function getField(product, ...names) {
  for (const name of names) {
    if (product[name]) return product[name];
  }
  return '';
}

/**
 * Map CSV data to Shopify product format
 * Supports FULL Shopify export format with ALL columns:
 * - Basic product info (Handle, Title, Body, Vendor, Type, Tags, Published)
 * - Product options (Option1/2/3 Name & Value)
 * - Variant details (SKU, Price, Compare At Price, Inventory, Weight, etc.)
 * - Inventory management (Tracker, Policy, Fulfillment Service)
 * - Images (Src, Position, Alt Text, Variant Image)
 * - Shipping & Tax (Requires Shipping, Taxable, Tax Code)
 * - SEO (Title, Description, Hidden)
 * - Google Shopping (MPN, Age Group, Gender, Product Category, AdWords, Condition, Custom Labels)
 * - Gift Card
 * - Cost per item
 */
export function mapToShopifyProduct(csvProduct) {
  // Support both old format (Published = TRUE/FALSE) and new format (Status = Active/Draft)
  const statusField = getField(csvProduct, 'Status', 'status');
  const publishedField = getField(
    csvProduct,
    'Published',
    'Published on online store',
    'published'
  );

  let status;
  if (statusField) {
    status = statusField.toLowerCase() === 'active' ? 'active' : 'draft';
  } else {
    status = parseBoolean(publishedField, true) ? 'active' : 'draft';
  }

  // Build product object with ALL supported fields (backward compatible: old + new Shopify format)
  const product = {
    // Basic product information
    handle: getField(csvProduct, 'Handle', 'URL handle', 'handle'),
    title: getField(csvProduct, 'Title', 'title'),
    description: getField(
      csvProduct,
      'Body (HTML)',
      'Description',
      'description',
      'body_html',
      'body'
    ),
    vendor: getField(csvProduct, 'Vendor', 'vendor'),
    productCategory: getField(csvProduct, 'Product category', 'product_category'),
    productType: getField(csvProduct, 'Type', 'product_type', 'productType'),
    tags: getField(csvProduct, 'Tags', 'tags'),
    status,

    // Product Options (for variants) - support both "Option1 Name" and "Option1 name"
    option1Name: getField(csvProduct, 'Option1 Name', 'Option1 name', 'option1_name'),
    option1Value: getField(csvProduct, 'Option1 Value', 'Option1 value', 'option1_value'),
    option1LinkedTo: getField(csvProduct, 'Option1 Linked To', 'option1_linked_to'),
    option2Name: getField(csvProduct, 'Option2 Name', 'Option2 name', 'option2_name'),
    option2Value: getField(csvProduct, 'Option2 Value', 'Option2 value', 'option2_value'),
    option2LinkedTo: getField(csvProduct, 'Option2 Linked To', 'option2_linked_to'),
    option3Name: getField(csvProduct, 'Option3 Name', 'Option3 name', 'option3_name'),
    option3Value: getField(csvProduct, 'Option3 Value', 'Option3 value', 'option3_value'),
    option3LinkedTo: getField(csvProduct, 'Option3 Linked To', 'option3_linked_to'),

    // Variant basic data
    sku: getField(csvProduct, 'Variant SKU', 'SKU', 'sku', 'variant_sku'),
    price: getField(csvProduct, 'Variant Price', 'Price', 'price', 'variant_price') || '0.00',
    compareAtPrice:
      getField(
        csvProduct,
        'Variant Compare At Price',
        'Compare-at price',
        'compare_at_price',
        'compareAtPrice'
      ) || null,
    barcode: getField(csvProduct, 'Variant Barcode', 'Barcode', 'barcode', 'variant_barcode'),

    // Inventory management
    inventoryQuantity: parseInt(
      getField(
        csvProduct,
        'Variant Inventory Qty',
        'Inventory quantity',
        'inventory_quantity',
        'inventoryQuantity'
      ) || 0
    ),
    inventoryTracker:
      getField(csvProduct, 'Variant Inventory Tracker', 'Inventory tracker', 'inventory_tracker') ||
      'shopify',
    inventoryPolicy: parseInventoryPolicy(
      getField(
        csvProduct,
        'Variant Inventory Policy',
        'Continue selling when out of stock',
        'inventory_policy'
      )
    ),
    fulfillmentService:
      getField(
        csvProduct,
        'Variant Fulfillment Service',
        'Fulfillment service',
        'fulfillment_service'
      ) || 'manual',

    // Weight and shipping
    weight: parseFloat(
      getField(csvProduct, 'Variant Grams', 'Weight value (grams)', 'weight', 'variant_grams') || 0
    ),
    weightUnit:
      getField(
        csvProduct,
        'Variant Weight Unit',
        'Weight unit for display',
        'weight_unit',
        'variant_weight_unit'
      ) || 'lb',
    requiresShipping: parseBoolean(
      getField(
        csvProduct,
        'Variant Requires Shipping',
        'Requires shipping',
        'requires_shipping',
        'variant_requires_shipping'
      ),
      true
    ),

    // Tax
    taxable: parseBoolean(
      getField(csvProduct, 'Variant Taxable', 'Charge tax', 'taxable', 'variant_taxable'),
      true
    ),
    taxCode: getField(csvProduct, 'Variant Tax Code', 'Tax code', 'tax_code', 'variant_tax_code'),

    // Cost
    cost: parseFloat(getField(csvProduct, 'Cost per item', 'cost', 'cost_per_item') || 0) || null,

    // Unit price (new format only)
    unitPriceTotalMeasure: getField(csvProduct, 'Unit price total measure'),
    unitPriceTotalMeasureUnit: getField(csvProduct, 'Unit price total measure unit'),
    unitPriceBaseMeasure: getField(csvProduct, 'Unit price base measure'),
    unitPriceBaseMeasureUnit: getField(csvProduct, 'Unit price base measure unit'),

    // Images
    imageUrl: getField(
      csvProduct,
      'Image Src',
      'Product image URL',
      'image_src',
      'imageUrl',
      'image_url'
    ),
    imagePosition: getField(csvProduct, 'Image Position', 'image_position'),
    imageAlt: getField(csvProduct, 'Image Alt Text', 'Image alt text', 'image_alt', 'imageAlt'),
    variantImage: getField(csvProduct, 'Variant Image', 'Variant image URL', 'variant_image'),

    // Gift Card
    giftCard: parseBoolean(getField(csvProduct, 'Gift Card', 'gift_card'), false),

    // Google Shopping / Merchant Center
    googleShoppingMPN: getField(
      csvProduct,
      'Google Shopping / MPN',
      'Google Shopping / Manufacturer part number (MPN)',
      'google_shopping_mpn',
      'mpn'
    ),
    googleShoppingAgeGroup: getField(
      csvProduct,
      'Google Shopping / Age Group',
      'Google Shopping / Age group',
      'google_shopping_age_group',
      'age_group'
    ),
    googleShoppingGender: getField(
      csvProduct,
      'Google Shopping / Gender',
      'google_shopping_gender',
      'gender'
    ),
    googleShoppingProductCategory: getField(
      csvProduct,
      'Google Shopping / Google Product Category',
      'Google Shopping / Google product category',
      'google_shopping_product_category',
      'google_product_category'
    ),
    googleShoppingAdWordsGrouping: getField(
      csvProduct,
      'Google Shopping / AdWords Grouping',
      'Google Shopping / Ad group name',
      'google_shopping_adwords_grouping',
      'adwords_grouping'
    ),
    googleShoppingAdWordsLabels: getField(
      csvProduct,
      'Google Shopping / AdWords Labels',
      'Google Shopping / Ads labels',
      'google_shopping_adwords_labels',
      'adwords_labels'
    ),
    googleShoppingCondition: getField(
      csvProduct,
      'Google Shopping / Condition',
      'google_shopping_condition',
      'condition'
    ),
    googleShoppingCustomProduct: getField(
      csvProduct,
      'Google Shopping / Custom Product',
      'Google Shopping / Custom product',
      'google_shopping_custom_product',
      'custom_product'
    ),
    googleShoppingCustomLabel0: getField(
      csvProduct,
      'Google Shopping / Custom Label 0',
      'Google Shopping / Custom label 0',
      'google_shopping_custom_label_0',
      'custom_label_0'
    ),
    googleShoppingCustomLabel1: getField(
      csvProduct,
      'Google Shopping / Custom Label 1',
      'Google Shopping / Custom label 1',
      'google_shopping_custom_label_1',
      'custom_label_1'
    ),
    googleShoppingCustomLabel2: getField(
      csvProduct,
      'Google Shopping / Custom Label 2',
      'Google Shopping / Custom label 2',
      'google_shopping_custom_label_2',
      'custom_label_2'
    ),
    googleShoppingCustomLabel3: getField(
      csvProduct,
      'Google Shopping / Custom Label 3',
      'Google Shopping / Custom label 3',
      'google_shopping_custom_label_3',
      'custom_label_3'
    ),
    googleShoppingCustomLabel4: getField(
      csvProduct,
      'Google Shopping / Custom Label 4',
      'Google Shopping / Custom label 4',
      'google_shopping_custom_label_4',
      'custom_label_4'
    ),

    // SEO
    seoTitle: getField(csvProduct, 'SEO Title', 'SEO title', 'seo_title', 'seoTitle'),
    seoDescription: getField(
      csvProduct,
      'SEO Description',
      'SEO description',
      'seo_description',
      'seoDescription'
    ),
    seoHidden: parseBoolean(
      getField(csvProduct, 'SEO Hidden (product.metafields.seo.hidden)', 'seo_hidden'),
      false
    ),

    // Color metafield (new format)
    colorPattern: getField(
      csvProduct,
      'Color (product.metafields.shopify.color-pattern)',
      'color_pattern'
    )
  };

  return product;
}

/**
 * Generate CSV template
 * Shopify 2024+ export format (58 columns) + SEO Hidden metafield
 */
export function generateCsvTemplate() {
  const headers = [
    'Title',
    'URL handle',
    'Description',
    'Vendor',
    'Product category',
    'Type',
    'Tags',
    'Published on online store',
    'Status',
    'SKU',
    'Barcode',
    'Option1 name',
    'Option1 value',
    'Option1 Linked To',
    'Option2 name',
    'Option2 value',
    'Option2 Linked To',
    'Option3 name',
    'Option3 value',
    'Option3 Linked To',
    'Price',
    'Compare-at price',
    'Cost per item',
    'Charge tax',
    'Tax code',
    'Unit price total measure',
    'Unit price total measure unit',
    'Unit price base measure',
    'Unit price base measure unit',
    'Inventory tracker',
    'Inventory quantity',
    'Continue selling when out of stock',
    'Weight value (grams)',
    'Weight unit for display',
    'Requires shipping',
    'Fulfillment service',
    'Product image URL',
    'Image position',
    'Image alt text',
    'Variant image URL',
    'Gift card',
    'SEO title',
    'SEO description',
    'SEO Hidden (product.metafields.seo.hidden)',
    'Color (product.metafields.shopify.color-pattern)',
    'Google Shopping / Google product category',
    'Google Shopping / Gender',
    'Google Shopping / Age group',
    'Google Shopping / Manufacturer part number (MPN)',
    'Google Shopping / Ad group name',
    'Google Shopping / Ads labels',
    'Google Shopping / Condition',
    'Google Shopping / Custom product',
    'Google Shopping / Custom label 0',
    'Google Shopping / Custom label 1',
    'Google Shopping / Custom label 2',
    'Google Shopping / Custom label 3',
    'Google Shopping / Custom label 4'
  ];

  const escapeCsv = v => {
    if (!v) return '';
    const str = v.toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  // Example row 1: main product row with first variant (Small/Green)
  const exampleRow1 = [
    'NFL Cap Cowboys', // Title
    'nfl-cap-cowboys', // URL handle
    'Official Dallas Cowboys NFL cap with adjustable strap. One size fits most.', // Description
    'NFL Official', // Vendor
    'Apparel & Accessories > Clothing Accessories > Hats', // Product category
    'Caps', // Type
    '"nfl, caps, sports, cowboys"', // Tags
    'TRUE', // Published on online store
    'Active', // Status
    'NFL-CAP-DAL-SB', // SKU
    '5784397001', // Barcode
    'Size', // Option1 name
    'Small', // Option1 value
    '', // Option1 Linked To
    'Color', // Option2 name
    'blue', // Option2 value
    'product.metafields.shopify.color-pattern', // Option2 Linked To
    '', // Option3 name
    '', // Option3 value
    '', // Option3 Linked To
    '29.99', // Price
    '39.99', // Compare-at price
    '15.00', // Cost per item
    'TRUE', // Charge tax
    '', // Tax code
    '', // Unit price total measure
    '', // Unit price total measure unit
    '', // Unit price base measure
    '', // Unit price base measure unit
    'shopify', // Inventory tracker
    '50', // Inventory quantity
    'DENY', // Continue selling when out of stock
    '200', // Weight value (grams)
    'g', // Weight unit for display
    'TRUE', // Requires shipping
    'manual', // Fulfillment service
    'https://burst.shopifycdn.com/photos/forest-hiker.jpg?width=1000', // Product image URL
    '1', // Image position
    'Blue Cowboys NFL Cap', // Image alt text
    '', // Variant image URL
    'FALSE', // Gift card
    'Dallas Cowboys NFL Cap - Official Licensed', // SEO title
    'Shop official Dallas Cowboys NFL cap. Adjustable strap.', // SEO description
    'FALSE', // SEO Hidden
    'blue', // Color metafield
    'Apparel & Accessories > Clothing Accessories > Hats', // Google Shopping / Google product category
    'Unisex', // Google Shopping / Gender
    'Adult', // Google Shopping / Age group
    'NFL-CAP-001', // Google Shopping / MPN
    'NFL Caps', // Google Shopping / Ad group name
    'Sports Merch', // Google Shopping / Ads labels
    'New', // Google Shopping / Condition
    'FALSE', // Google Shopping / Custom product
    'Best Seller', // Google Shopping / Custom label 0
    '', // Google Shopping / Custom label 1
    '', // Google Shopping / Custom label 2
    '', // Google Shopping / Custom label 3
    '' // Google Shopping / Custom label 4
  ];

  // Example row 2: variant row (Small/Red) - only variant-level fields
  const exampleRow2 = [
    '', // Title (empty for variant rows)
    'nfl-cap-cowboys', // URL handle
    '', // Description
    '', // Vendor
    '', // Product category
    '', // Type
    '', // Tags
    '', // Published on online store
    '', // Status
    'NFL-CAP-DAL-SR', // SKU
    '5784397002', // Barcode
    '', // Option1 name
    'Small', // Option1 value
    '', // Option1 Linked To
    '', // Option2 name
    'red', // Option2 value
    '', // Option2 Linked To
    '', // Option3 name
    '', // Option3 value
    '', // Option3 Linked To
    '29.99', // Price
    '39.99', // Compare-at price
    '15.00', // Cost per item
    'TRUE', // Charge tax
    '', // Tax code
    '', // Unit price total measure
    '', // Unit price total measure unit
    '', // Unit price base measure
    '', // Unit price base measure unit
    'shopify', // Inventory tracker
    '35', // Inventory quantity
    'DENY', // Continue selling when out of stock
    '200', // Weight value (grams)
    'g', // Weight unit for display
    'TRUE', // Requires shipping
    'manual', // Fulfillment service
    '', // Product image URL
    '2', // Image position
    'Red Cowboys NFL Cap', // Image alt text
    '', // Variant image URL
    '', // Gift card
    '', // SEO title
    '', // SEO description
    '', // SEO Hidden
    '', // Color metafield
    '', // Google Shopping / Google product category
    '', // Google Shopping / Gender
    '', // Google Shopping / Age group
    'NFL-CAP-002', // Google Shopping / MPN
    '', // Google Shopping / Ad group name
    '', // Google Shopping / Ads labels
    '', // Google Shopping / Condition
    '', // Google Shopping / Custom product
    '', // Google Shopping / Custom label 0
    '', // Google Shopping / Custom label 1
    '', // Google Shopping / Custom label 2
    '', // Google Shopping / Custom label 3
    '' // Google Shopping / Custom label 4
  ];

  const headerLine = headers.map(escapeCsv).join(',');
  const row1Line = exampleRow1.map(escapeCsv).join(',');
  const row2Line = exampleRow2.map(escapeCsv).join(',');

  return headerLine + '\n' + row1Line + '\n' + row2Line;
}
