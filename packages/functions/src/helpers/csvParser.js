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

  // Required fields - check both format variations
  const title = product.Title || product.title;
  if (!title || !title.trim()) {
    errors.push('Title is required');
  }

  // Optional but validated fields
  const price = product['Variant Price'] || product.price || product.variant_price;
  if (price && isNaN(parseFloat(price))) {
    errors.push('Price must be a valid number');
  }

  const compareAtPrice =
    product['Variant Compare At Price'] || product.compare_at_price || product.compareAtPrice;
  if (compareAtPrice && isNaN(parseFloat(compareAtPrice))) {
    errors.push('Compare at price must be a valid number');
  }

  const inventoryQty =
    product['Variant Inventory Qty'] || product.inventory_quantity || product.inventoryQuantity;
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
  const published = getField(csvProduct, 'Published', 'published');
  const isPublished = parseBoolean(published, true);

  // Build product object with ALL supported fields
  const product = {
    // Basic product information
    handle: getField(csvProduct, 'Handle', 'handle'),
    title: getField(csvProduct, 'Title', 'title'),
    description: getField(csvProduct, 'Body (HTML)', 'description', 'body_html', 'body'),
    vendor: getField(csvProduct, 'Vendor', 'vendor'),
    productType: getField(csvProduct, 'Type', 'product_type', 'productType'),
    tags: getField(csvProduct, 'Tags', 'tags'),
    status: isPublished ? 'active' : 'draft',

    // Product Options (for variants)
    option1Name: getField(csvProduct, 'Option1 Name', 'option1_name'),
    option1Value: getField(csvProduct, 'Option1 Value', 'option1_value'),
    option2Name: getField(csvProduct, 'Option2 Name', 'option2_name'),
    option2Value: getField(csvProduct, 'Option2 Value', 'option2_value'),
    option3Name: getField(csvProduct, 'Option3 Name', 'option3_name'),
    option3Value: getField(csvProduct, 'Option3 Value', 'option3_value'),

    // Variant basic data
    sku: getField(csvProduct, 'Variant SKU', 'sku', 'variant_sku'),
    price: getField(csvProduct, 'Variant Price', 'price', 'variant_price') || '0.00',
    compareAtPrice:
      getField(csvProduct, 'Variant Compare At Price', 'compare_at_price', 'compareAtPrice') ||
      null,
    barcode: getField(csvProduct, 'Variant Barcode', 'barcode', 'variant_barcode'),

    // Inventory management
    inventoryQuantity: parseInt(
      getField(csvProduct, 'Variant Inventory Qty', 'inventory_quantity', 'inventoryQuantity') || 0
    ),
    inventoryTracker:
      getField(csvProduct, 'Variant Inventory Tracker', 'inventory_tracker') || 'shopify',
    inventoryPolicy: getField(csvProduct, 'Variant Inventory Policy', 'inventory_policy') || 'deny',
    fulfillmentService:
      getField(csvProduct, 'Variant Fulfillment Service', 'fulfillment_service') || 'manual',

    // Weight and shipping
    weight: parseFloat(getField(csvProduct, 'Variant Grams', 'weight', 'variant_grams') || 0),
    weightUnit:
      getField(csvProduct, 'Variant Weight Unit', 'weight_unit', 'variant_weight_unit') || 'lb',
    requiresShipping: parseBoolean(
      getField(
        csvProduct,
        'Variant Requires Shipping',
        'requires_shipping',
        'variant_requires_shipping'
      ),
      true
    ),

    // Tax
    taxable: parseBoolean(
      getField(csvProduct, 'Variant Taxable', 'taxable', 'variant_taxable'),
      true
    ),
    taxCode: getField(csvProduct, 'Variant Tax Code', 'tax_code', 'variant_tax_code'),

    // Cost
    cost: parseFloat(getField(csvProduct, 'Cost per item', 'cost', 'cost_per_item') || 0) || null,

    // Images
    imageUrl: getField(csvProduct, 'Image Src', 'image_src', 'imageUrl', 'image_url'),
    imagePosition: getField(csvProduct, 'Image Position', 'image_position'),
    imageAlt: getField(csvProduct, 'Image Alt Text', 'image_alt', 'imageAlt'),
    variantImage: getField(csvProduct, 'Variant Image', 'variant_image'),

    // Gift Card
    giftCard: parseBoolean(getField(csvProduct, 'Gift Card', 'gift_card'), false),

    // Google Shopping / Merchant Center
    googleShoppingMPN: getField(csvProduct, 'Google Shopping / MPN', 'google_shopping_mpn', 'mpn'),
    googleShoppingAgeGroup: getField(
      csvProduct,
      'Google Shopping / Age Group',
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
      'google_shopping_product_category',
      'google_product_category'
    ),
    googleShoppingAdWordsGrouping: getField(
      csvProduct,
      'Google Shopping / AdWords Grouping',
      'google_shopping_adwords_grouping',
      'adwords_grouping'
    ),
    googleShoppingAdWordsLabels: getField(
      csvProduct,
      'Google Shopping / AdWords Labels',
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
      'google_shopping_custom_product',
      'custom_product'
    ),
    googleShoppingCustomLabel0: getField(
      csvProduct,
      'Google Shopping / Custom Label 0',
      'google_shopping_custom_label_0',
      'custom_label_0'
    ),
    googleShoppingCustomLabel1: getField(
      csvProduct,
      'Google Shopping / Custom Label 1',
      'google_shopping_custom_label_1',
      'custom_label_1'
    ),
    googleShoppingCustomLabel2: getField(
      csvProduct,
      'Google Shopping / Custom Label 2',
      'google_shopping_custom_label_2',
      'custom_label_2'
    ),
    googleShoppingCustomLabel3: getField(
      csvProduct,
      'Google Shopping / Custom Label 3',
      'google_shopping_custom_label_3',
      'custom_label_3'
    ),
    googleShoppingCustomLabel4: getField(
      csvProduct,
      'Google Shopping / Custom Label 4',
      'google_shopping_custom_label_4',
      'custom_label_4'
    ),

    // SEO
    seoTitle: getField(csvProduct, 'SEO Title', 'seo_title', 'seoTitle'),
    seoDescription: getField(csvProduct, 'SEO Description', 'seo_description', 'seoDescription'),
    seoHidden: parseBoolean(
      getField(csvProduct, 'SEO Hidden (product.metafields.seo.hidden)', 'seo_hidden'),
      false
    )
  };

  return product;
}

/**
 * Generate CSV template
 * Provides FULL Shopify export format template
 */
export function generateCsvTemplate() {
  const headers = [
    'Handle',
    'Title',
    'Body (HTML)',
    'Vendor',
    'Type',
    'Tags',
    'Published',
    'Option1 Name',
    'Option1 Value',
    'Option2 Name',
    'Option2 Value',
    'Option3 Name',
    'Option3 Value',
    'Variant SKU',
    'Variant Grams',
    'Variant Inventory Tracker',
    'Variant Inventory Qty',
    'Variant Inventory Policy',
    'Variant Fulfillment Service',
    'Variant Price',
    'Variant Compare At Price',
    'Variant Requires Shipping',
    'Variant Taxable',
    'Variant Barcode',
    'Image Src',
    'Image Position',
    'Image Alt Text',
    'Gift Card',
    'Google Shopping / MPN',
    'Google Shopping / Age Group',
    'Google Shopping / Gender',
    'Google Shopping / Google Product Category',
    'SEO Title',
    'SEO Description',
    'Google Shopping / AdWords Grouping',
    'Google Shopping / AdWords Labels',
    'Google Shopping / Condition',
    'Google Shopping / Custom Product',
    'Google Shopping / Custom Label 0',
    'Google Shopping / Custom Label 1',
    'Google Shopping / Custom Label 2',
    'Google Shopping / Custom Label 3',
    'Google Shopping / Custom Label 4',
    'Variant Image',
    'Variant Weight Unit',
    'Variant Tax Code',
    'Cost per item',
    'SEO Hidden (product.metafields.seo.hidden)'
  ];

  const exampleRow = [
    'nfl-cap-cowboys', // Handle
    'Dallas Cowboys NFL Cap', // Title
    '<p>Official Dallas Cowboys NFL cap with adjustable strap.</p>', // Body (HTML)
    'NFL Official', // Vendor
    'Caps', // Type
    'nfl, caps, sports, cowboys', // Tags
    'TRUE', // Published
    'Size', // Option1 Name
    'One Size', // Option1 Value
    'Color', // Option2 Name
    'Blue', // Option2 Value
    '', // Option3 Name
    '', // Option3 Value
    'NFL-CAP-DAL-001', // Variant SKU
    '200', // Variant Grams
    'shopify', // Variant Inventory Tracker
    '100', // Variant Inventory Qty
    'deny', // Variant Inventory Policy
    'manual', // Variant Fulfillment Service
    '29.99', // Variant Price
    '39.99', // Variant Compare At Price
    'TRUE', // Variant Requires Shipping
    'TRUE', // Variant Taxable
    '123456789012', // Variant Barcode
    'https://example.com/images/cowboys-cap.jpg', // Image Src
    '1', // Image Position
    'Dallas Cowboys Blue NFL Cap', // Image Alt Text
    'FALSE', // Gift Card
    'NFL-CAP-001', // Google Shopping / MPN
    'Adult', // Google Shopping / Age Group
    'Unisex', // Google Shopping / Gender
    'Apparel & Accessories > Clothing Accessories > Hats', // Google Shopping / Google Product Category
    'Buy Dallas Cowboys NFL Cap - Official Licensed', // SEO Title
    'Shop official Dallas Cowboys NFL cap. Adjustable, one size fits all. Free shipping on orders over $50.', // SEO Description
    'NFL Caps', // Google Shopping / AdWords Grouping
    'Sports, NFL, Cowboys', // Google Shopping / AdWords Labels
    'new', // Google Shopping / Condition
    'FALSE', // Google Shopping / Custom Product
    'Best Seller', // Google Shopping / Custom Label 0
    'Official Licensed', // Google Shopping / Custom Label 1
    'Sports Merchandise', // Google Shopping / Custom Label 2
    '', // Google Shopping / Custom Label 3
    '', // Google Shopping / Custom Label 4
    'https://example.com/images/cowboys-cap-variant.jpg', // Variant Image
    'lb', // Variant Weight Unit
    '', // Variant Tax Code
    '15.00', // Cost per item
    'FALSE' // SEO Hidden
  ];

  // Add header comment explaining format
  const comment =
    '# Full Shopify Product Export Format - All 48 columns supported\n# This template includes all fields from Shopify product export CSV\n';

  return comment + headers.join(',') + '\n' + exampleRow.join(',');
}
