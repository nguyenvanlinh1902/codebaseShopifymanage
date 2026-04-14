/**
 * Read CSV files from Firebase Storage, detect encoding, merge by handle.
 * Used by the storage-based import flow (batchId + fileNames).
 */
import {getStorage} from 'firebase-admin/storage';
import {parseCsv, mapToShopifyProduct, groupCsvRowsByHandle, validateGroupedProduct} from './csvParser.js';

/**
 * Detect encoding and decode buffer to string.
 * Checks BOM first, tries UTF-8, falls back to latin1 (Windows-1252 superset).
 */
export function detectAndDecode(buffer) {
  // UTF-8 BOM (EF BB BF)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return {text: buffer.subarray(3).toString('utf8'), encoding: 'utf-8-bom'};
  }

  // Try UTF-8 strict
  try {
    const decoder = new TextDecoder('utf-8', {fatal: true});
    const text = decoder.decode(buffer);
    return {text, encoding: 'utf-8'};
  } catch {
    // Fallback to latin1 (never throws, covers Windows-1252)
    return {text: buffer.toString('latin1'), encoding: 'latin1'};
  }
}

/**
 * Read and merge CSV files from Firebase Storage.
 * Downloads each file, decodes, parses, groups by handle, then merges across files.
 *
 * @param {string} batchId - UUID identifying the upload batch
 * @param {string[]} fileNames - List of CSV file names in the batch
 * @returns {{ mergedProducts, invalidProducts, fileStats, errors }}
 */
export async function readAndMergeCsvFiles(batchId, fileNames) {
  const bucket = getStorage().bucket();
  const allGrouped = [];
  const fileStats = [];
  const errors = [];

  // Process files in parallel batches of 10 to avoid timeout on large uploads
  const BATCH_SIZE = 10;
  for (let i = 0; i < fileNames.length; i += BATCH_SIZE) {
    const batch = fileNames.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(fileName => processOneFile(bucket, batchId, fileName))
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        const {grouped, stats} = results[j].value;
        allGrouped.push(...grouped);
        fileStats.push(stats);
      } else {
        errors.push({fileName: batch[j], error: results[j].reason?.message || 'Unknown error'});
      }
    }
  }

  // Merge by handle across all files
  const merged = mergeProductsByHandle(allGrouped);

  // Validate merged products
  const validProducts = [];
  const invalidProducts = [];

  for (const product of merged) {
    const validationErrors = validateGroupedProduct(product);
    if (validationErrors.length > 0) {
      invalidProducts.push({title: product.title || product.handle, errors: validationErrors});
    } else {
      validProducts.push(product);
    }
  }

  return {mergedProducts: validProducts, invalidProducts, fileStats, errors};
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

/** Download, decode, parse and group a single CSV file from Storage. */
async function processOneFile(bucket, batchId, fileName) {
  const filePath = `csv-imports/${batchId}/${fileName}`;
  const [buffer] = await bucket.file(filePath).download();

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB, max 50MB)`);
  }

  const {text, encoding} = detectAndDecode(buffer);

  const rows = parseCsv(text);
  const mapped = rows.map(row => mapToShopifyProduct(row));
  const grouped = groupCsvRowsByHandle(mapped);

  return {
    grouped,
    stats: {
      fileName, encoding,
      productCount: grouped.length,
      rowCount: rows.length,
      variantCount: grouped.reduce((sum, p) => sum + (p.variants?.length || 1), 0)
    }
  };
}

/**
 * Merge products by handle across multiple files.
 * Strategy: last-file-wins for product-level fields, variants accumulate (dedup by option combo).
 */
function mergeProductsByHandle(products) {
  const map = new Map();

  for (const product of products) {
    const handle = product.handle;
    if (!handle) continue;

    if (!map.has(handle)) {
      map.set(handle, product);
      continue;
    }

    const existing = map.get(handle);

    // Product-level: last-file-wins
    if (product.title) existing.title = product.title;
    if (product.description) existing.description = product.description;
    if (product.vendor) existing.vendor = product.vendor;
    if (product.productType) existing.productType = product.productType;
    if (product.tags) existing.tags = product.tags;
    if (product.seoTitle) existing.seoTitle = product.seoTitle;
    if (product.seoDescription) existing.seoDescription = product.seoDescription;
    existing.status = product.status || existing.status;

    // Option names: last-file-wins
    if (product.option1Name) existing.option1Name = product.option1Name;
    if (product.option2Name) existing.option2Name = product.option2Name;
    if (product.option3Name) existing.option3Name = product.option3Name;

    // Variants: dedup by option combo, newer replaces older
    mergeVariants(existing, product.variants || []);

    // Images: dedup by src
    mergeImages(existing, product.images || []);
  }

  return Array.from(map.values());
}

/** Merge variants into existing product. Dedup by option1+option2+option3 combo. */
function mergeVariants(existing, newVariants) {
  const variantKey = v =>
    `${v.option1Value || ''}|${v.option2Value || ''}|${v.option3Value || ''}`;

  const keyMap = new Map();
  for (const v of existing.variants || []) {
    keyMap.set(variantKey(v), v);
  }
  for (const v of newVariants) {
    keyMap.set(variantKey(v), v); // newer replaces older
  }
  existing.variants = Array.from(keyMap.values());
}

/** Merge images into existing product. Dedup by src URL. */
function mergeImages(existing, newImages) {
  const srcSet = new Set((existing.images || []).map(img => img.src));
  for (const img of newImages) {
    if (img.src && !srcSet.has(img.src)) {
      srcSet.add(img.src);
      existing.images.push(img);
    }
  }
}
