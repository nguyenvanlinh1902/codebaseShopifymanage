/**
 * CSV Parser Helper
 * Parses CSV files for product import
 */

/**
 * Parse CSV string to array of objects
 */
export function parseCsv(csvString) {
  // Remove UTF-8 BOM if present (common in Excel exports)
  const cleanedString = csvString.replace(/^\uFEFF/, '');
  const lines = cleanedString.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  // Parse header
  const headers = parseRow(lines[0]);

  // Parse data rows
  const products = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);

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
 * Parse a single CSV row (handles quoted values)
 */
function parseRow(row) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
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
    } else {
      current += char;
    }
  }

  // Add last cell
  cells.push(current);

  return cells;
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

  const compareAtPrice = product['Variant Compare At Price'] || product.compare_at_price || product.compareAtPrice;
  if (compareAtPrice && isNaN(parseFloat(compareAtPrice))) {
    errors.push('Compare at price must be a valid number');
  }

  const inventoryQty = product['Variant Inventory Qty'] || product.inventory_quantity || product.inventoryQuantity;
  if (inventoryQty && isNaN(parseInt(inventoryQty))) {
    errors.push('Inventory quantity must be a valid integer');
  }

  return errors;
}

/**
 * Map CSV data to Shopify product format
 * Handles multiple CSV formats:
 * - Shopify export format (Title, Body (HTML), Variant SKU, Variant Price, etc.)
 * - Simplified format (title, description, sku, price, etc.)
 */
export function mapToShopifyProduct(csvProduct) {
  return {
    title: csvProduct.Title || csvProduct.title || '',
    description: csvProduct['Body (HTML)'] || csvProduct.description || csvProduct.body_html || '',
    vendor: csvProduct.Vendor || csvProduct.vendor || '',
    productType: csvProduct.Type || csvProduct.product_type || csvProduct.productType || '',
    tags: csvProduct.Tags || csvProduct.tags || '',
    status: csvProduct.Published === 'TRUE' || csvProduct.Published === 'true'
      ? 'active'
      : (csvProduct.status || 'draft'),
    price: csvProduct['Variant Price'] || csvProduct.price || csvProduct.variant_price || '0.00',
    compareAtPrice: csvProduct['Variant Compare At Price'] || csvProduct.compare_at_price || csvProduct.compareAtPrice || null,
    sku: csvProduct['Variant SKU'] || csvProduct.sku || csvProduct.variant_sku || '',
    barcode: csvProduct['Variant Barcode'] || csvProduct.barcode || csvProduct.variant_barcode || '',
    inventoryQuantity: parseInt(
      csvProduct['Variant Inventory Qty'] ||
      csvProduct.inventory_quantity ||
      csvProduct.inventoryQuantity ||
      0
    ),
    imageUrl: csvProduct['Image Src'] || csvProduct.image_src || csvProduct.imageUrl || '',
    handle: csvProduct.Handle || csvProduct.handle || ''
  };
}

/**
 * Generate CSV template
 * Provides simplified format (also accepts Shopify export format)
 */
export function generateCsvTemplate() {
  const headers = [
    'title',
    'description',
    'vendor',
    'product_type',
    'tags',
    'price',
    'compare_at_price',
    'sku',
    'barcode',
    'inventory_quantity',
    'image_src',
    'status'
  ];

  const exampleRow = [
    'Example Product',
    'This is a sample product description',
    'My Brand',
    'Electronics',
    'new, featured',
    '29.99',
    '39.99',
    'SKU-001',
    '123456789',
    '100',
    'https://example.com/image.jpg',
    'active'
  ];

  // Add header comment explaining format compatibility
  const comment = '# This is a simplified format. Shopify product export CSV files are also supported.\n';

  return comment + headers.join(',') + '\n' + exampleRow.join(',');
}
