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
    const valueSets = optionNames.map(() => new Set());
    for (const v of csvVariants) {
      if (v.option1Value && optionNames[0]) valueSets[0].add(v.option1Value);
      if (v.option2Value && optionNames[1]) valueSets[1].add(v.option2Value);
      if (v.option3Value && optionNames[2]) valueSets[2].add(v.option3Value);
    }
    input.productOptions = optionNames.map((name, i) => ({
      name,
      values: [...valueSets[i]].map(v => ({name: v}))
    }));
  }

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
    const optVals = [];
    if (v.option1Value && optionNames[0]) optVals.push({optionName: optionNames[0], name: v.option1Value});
    if (v.option2Value && optionNames[1]) optVals.push({optionName: optionNames[1], name: v.option2Value});
    if (v.option3Value && optionNames[2]) optVals.push({optionName: optionNames[2], name: v.option3Value});
    if (optVals.length === 0) optVals.push({optionName: 'Title', name: 'Default Title'});

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
