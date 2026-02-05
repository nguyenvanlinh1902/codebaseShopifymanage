/**
 * CSV Parser Helper
 * Parses CSV files for product import
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
  // Parse Published field - handles TRUE, True, true, or empty (defaults to active)
  const published = csvProduct.Published || csvProduct.published || '';
  const isPublished = published.toLowerCase() === 'true' || published === '1' || published === '';

  return {
    title: csvProduct.Title || csvProduct.title || '',
    description: csvProduct['Body (HTML)'] || csvProduct.description || csvProduct.body_html || '',
    vendor: csvProduct.Vendor || csvProduct.vendor || '',
    productType: csvProduct.Type || csvProduct.product_type || csvProduct.productType || '',
    tags: csvProduct.Tags || csvProduct.tags || '',
    status: isPublished ? 'active' : 'draft',
    handle: csvProduct.Handle || csvProduct.handle || '',

    // Variant data
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
    weight: parseFloat(csvProduct['Variant Grams'] || csvProduct.weight || 0),
    weightUnit: csvProduct['Variant Weight Unit'] || csvProduct.weight_unit || 'lb',
    requiresShipping: (csvProduct['Variant Requires Shipping'] || 'True').toLowerCase() === 'true',
    taxable: (csvProduct['Variant Taxable'] || 'True').toLowerCase() === 'true',
    cost: parseFloat(csvProduct['Cost per item'] || csvProduct.cost || 0) || null,

    // Image data
    imageUrl: csvProduct['Image Src'] || csvProduct.image_src || csvProduct.imageUrl || '',
    imageAlt: csvProduct['Image Alt Text'] || csvProduct.image_alt || csvProduct.imageAlt || '',

    // SEO data
    seoTitle: csvProduct['SEO Title'] || csvProduct.seo_title || csvProduct.seoTitle || '',
    seoDescription: csvProduct['SEO Description'] || csvProduct.seo_description || csvProduct.seoDescription || ''
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
    'published',
    'handle',
    'price',
    'compare_at_price',
    'sku',
    'barcode',
    'inventory_quantity',
    'weight',
    'weight_unit',
    'requires_shipping',
    'taxable',
    'cost',
    'image_src',
    'image_alt',
    'seo_title',
    'seo_description'
  ];

  const exampleRow = [
    'Example Product',
    'This is a sample product description',
    'My Brand',
    'Electronics',
    'new, featured',
    'True',
    'example-product',
    '29.99',
    '39.99',
    'SKU-001',
    '123456789',
    '100',
    '0',
    'lb',
    'True',
    'True',
    '20.00',
    'https://example.com/image.jpg',
    'Example Product Image',
    'Buy Example Product - Best Electronics',
    'High quality example product with free shipping. Perfect for home and office use.'
  ];

  // Add header comment explaining format compatibility
  const comment = '# Simplified format. Shopify product export CSV (with fields like "Title", "Body (HTML)", "Variant Price") is also fully supported.\n';

  return comment + headers.join(',') + '\n' + exampleRow.join(',');
}
