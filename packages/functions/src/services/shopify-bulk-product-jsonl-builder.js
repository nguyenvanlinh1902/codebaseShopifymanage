/**
 * Builds Shopify ProductSetInput JSONL for bulk mutation imports.
 * Each line: {"input": <ProductSetInput>}
 */

const MAX_VARIANTS_PER_PRODUCT = 2000; // Shopify limit is 2048, keep margin

function buildProductSetInput(productData) {
  let csvVariants = productData.variants?.length > 0 ? productData.variants : [productData];
  const optionNames = [productData.option1Name, productData.option2Name, productData.option3Name].filter(Boolean);

  // Shopify hard limit: 2048 variants per product
  if (csvVariants.length > MAX_VARIANTS_PER_PRODUCT) {
    console.warn(`Product "${productData.title}" has ${csvVariants.length} variants, truncating to ${MAX_VARIANTS_PER_PRODUCT}`);
    csvVariants = csvVariants.slice(0, MAX_VARIANTS_PER_PRODUCT);
  }

  const input = {title: productData.title};
  if (productData.description) input.descriptionHtml = productData.description;
  if (productData.vendor) input.vendor = productData.vendor;
  if (productData.productType) input.productType = productData.productType;
  if (productData.handle) input.handle = productData.handle;
  if (productData.giftCard) input.giftCard = true;
  input.status = (productData.status || 'draft').toUpperCase();

  if (productData.tags) {
    input.tags = productData.tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  if (productData.seoTitle || productData.seoDescription) {
    input.seo = {};
    if (productData.seoTitle) input.seo.title = productData.seoTitle;
    if (productData.seoDescription) input.seo.description = productData.seoDescription;
  }

  if (optionNames.length > 0) {
    // Skip variants missing any required option value — they'd otherwise produce
    // mismatched optionValues count or pollute storefront with placeholder values.
    const validVariants = csvVariants.filter(v => {
      for (let i = 0; i < optionNames.length; i++) {
        if (!v[`option${i + 1}Value`]) return false;
      }
      return true;
    });
    if (validVariants.length < csvVariants.length) {
      console.warn(
        `[bulk-import] Product "${productData.title}": skipped ${csvVariants.length - validVariants.length}/${csvVariants.length} variant(s) missing option value(s)`
      );
    }
    csvVariants = validVariants.length > 0 ? validVariants : csvVariants.slice(0, 1); // keep at least one row to surface error

    const valueSets = optionNames.map(() => new Set());
    for (const v of csvVariants) {
      if (v.option1Value) valueSets[0].add(v.option1Value);
      if (v.option2Value && optionNames[1]) valueSets[1].add(v.option2Value);
      if (v.option3Value && optionNames[2]) valueSets[2].add(v.option3Value);
    }
    input.productOptions = optionNames.map((name, i) => ({
      name,
      values: [...valueSets[i]].map(v => ({name: v}))
    }));
  } else {
    // Shopify requires productOptions whenever variants are provided (even upsert).
    // Without options, use a single "Title" option to satisfy the API.
    input.productOptions = [{name: 'Title', values: [{name: 'Default Title'}]}];
  }

  // Dedupe variants by option-value combination — keep-last strategy:
  // if multiple rows share the same option combo, the later row overrides the earlier.
  const variantByKey = new Map();
  for (const v of csvVariants) {
    const key = [v.option1Value || '', v.option2Value || '', v.option3Value || ''].join('|');
    variantByKey.set(key, v);
  }
  csvVariants = [...variantByKey.values()];

  const allImageUrls = new Set();
  const imagesToUpload = [];
  if (productData.images?.length > 0) {
    for (const img of productData.images) {
      if (img.src && !allImageUrls.has(img.src)) {
        allImageUrls.add(img.src);
        imagesToUpload.push(img);
      }
    }
  } else if (productData.imageUrl) {
    allImageUrls.add(productData.imageUrl);
    imagesToUpload.push({src: productData.imageUrl, alt: productData.imageAlt});
  }
  for (const v of csvVariants) {
    if (v.variantImage && !allImageUrls.has(v.variantImage)) {
      allImageUrls.add(v.variantImage);
      imagesToUpload.push({src: v.variantImage});
    }
  }
  if (imagesToUpload.length > 0) {
    input.files = imagesToUpload.map(img => ({
      originalSource: img.src,
      alt: img.alt || undefined,
      contentType: 'IMAGE'
    }));
  }

  input.variants = csvVariants.map(v => {
    let optVals;
    if (optionNames.length > 0) {
      // Product has real options — variant must have exactly one value per option.
      // (Variants missing any value were already filtered out above.)
      optVals = optionNames.map((name, i) => ({
        optionName: name,
        name: v[`option${i + 1}Value`]
      }));
    } else {
      // No real options — use synthetic Title option to match productOptions fallback.
      optVals = [{optionName: 'Title', name: 'Default Title'}];
    }

    const variant = {
      optionValues: optVals,
      price: v.price || '0.00',
      sku: v.sku || '',
      inventoryPolicy: (v.inventoryPolicy || 'deny').toUpperCase() === 'CONTINUE' ? 'CONTINUE' : 'DENY',
      inventoryItem: {sku: v.sku || '', tracked: (v.inventoryTracker || 'shopify') === 'shopify'},
      taxable: v.taxable !== undefined ? v.taxable : true
    };
    if (v.compareAtPrice) variant.compareAtPrice = v.compareAtPrice;
    if (v.barcode) variant.barcode = v.barcode;
    if (v.taxCode) variant.taxCode = v.taxCode;
    if (v.cost) variant.inventoryItem.cost = v.cost;
    if (v.variantImage) variant.file = {originalSource: v.variantImage};
    return variant;
  });

  return input;
}

/**
 * Convert array of parsed CSV products to JSONL string.
 * Each line: {"input": <ProductSetInput>, "identifier": {"handle": "..."}}
 * The identifier enables upsert — update existing product if handle matches.
 */
export function buildProductJsonl(products) {
  const handleCounts = new Map();
  let noHandleCount = 0;
  for (const p of products) {
    if (!p.handle) {
      noHandleCount++;
      continue;
    }
    handleCounts.set(p.handle, (handleCounts.get(p.handle) || 0) + 1);
  }

  const duplicates = [...handleCounts.entries()].filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    const totalDuplicateRows = duplicates.reduce((sum, [, count]) => sum + count, 0);
    const uniqueDuplicateHandles = duplicates.length;
    const extraRows = totalDuplicateRows - uniqueDuplicateHandles; // rows that will be upserted into existing ones
    console.warn(
      `[bulk-import] Duplicate handles detected: ${uniqueDuplicateHandles} handle(s) appear in ${totalDuplicateRows} rows → ${extraRows} row(s) will UPSERT into existing product (merge, not create). ` +
      `Sample: ${duplicates.slice(0, 5).map(([h, c]) => `"${h}" x${c}`).join(', ')}${duplicates.length > 5 ? '…' : ''}`
    );
  }
  if (noHandleCount > 0) {
    console.log(`[bulk-import] ${noHandleCount} product(s) have no handle (will create new, no upsert)`);
  }
  console.log(
    `[bulk-import] JSONL summary: ${products.length} rows → ${handleCounts.size} unique handles + ${noHandleCount} no-handle = ${handleCounts.size + noHandleCount} expected products in Shopify`
  );

  return products.map(p => {
    const input = buildProductSetInput(p);
    const line = {input};
    // Add identifier for upsert by handle (update if exists, create if not)
    if (p.handle) {
      line.identifier = {handle: p.handle};
    }
    return JSON.stringify(line);
  }).join('\n');
}
