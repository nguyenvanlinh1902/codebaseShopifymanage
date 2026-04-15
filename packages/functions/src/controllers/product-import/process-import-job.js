/**
 * Background handler: Process import jobs from PubSub.
 * Multi-store: reads products once from Storage, runs Bulk Operations per store sequentially.
 * Each store uses up to 5 concurrent bulk ops (API 2026-04).
 */

import {ImportHistoryRepository} from '../../repositories/importHistoryRepository.js';
import {StoreRepository} from '../../repositories/storeRepository.js';
import {ShopifyService} from '../../services/shopifyService.js';
import {runConcurrentBulkImport} from '../../services/shopify-bulk-import-service.js';
import {readAndMergeCsvFiles} from '../../helpers/storage-csv-reader.js';

const importHistoryRepo = new ImportHistoryRepository();
const storeRepo = new StoreRepository();

/**
 * Entry point from PubSub trigger.
 */
export async function processProductImport(messageData) {
  console.log('[import] PubSub message received:', JSON.stringify(messageData?.message?.json || {}).slice(0, 500));
  const data = messageData.message.json;
  const {importJobs, batchId, fileNames} = data;

  // Load products from Storage CSV or Firestore subcollection (legacy)
  let products;
  if (batchId && fileNames?.length) {
    const result = await readAndMergeCsvFiles(batchId, fileNames);
    products = result.mergedProducts;
    if (result.errors?.length) {
      console.warn(`[import] ${result.errors.length} file(s) failed to parse`);
    }
  } else if (data.importId) {
    products = await importHistoryRepo.getImportProducts(data.importId);
  }

  if (!products?.length) {
    const jobs = importJobs || [{importId: data.importId}];
    for (const job of jobs) {
      await importHistoryRepo.markFailed(job.importId, 'No products found. CSV files may have expired — please re-upload.');
    }
    return;
  }

  const jobs = importJobs || [{
    importId: data.importId, storeId: data.storeId, storeName: data.storeName
  }];

  console.log(`[import] ${products.length} products → ${jobs.length} store(s)`);

  // Update totalProducts now that we've parsed (controller skips parsing for speed)
  const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 1), 0);

  // Detect duplicate handles (same handle = upsert into same product, not create new)
  const handleCounts = new Map();
  let noHandleCount = 0;
  for (const p of products) {
    if (!p.handle) { noHandleCount++; continue; }
    handleCounts.set(p.handle, (handleCounts.get(p.handle) || 0) + 1);
  }
  const duplicateHandles = [...handleCounts.entries()].filter(([, c]) => c > 1);
  const duplicateRows = duplicateHandles.reduce((s, [, c]) => s + c, 0) - duplicateHandles.length;
  const expectedUniqueProducts = handleCounts.size + noHandleCount;
  const duplicateSamples = duplicateHandles.slice(0, 10).map(([h, c]) => ({handle: h, count: c}));

  console.log(
    `[import] ${products.length} rows → ${handleCounts.size} unique handles + ${noHandleCount} no-handle = ${expectedUniqueProducts} expected products. ${duplicateRows} duplicate row(s) will UPSERT.`
  );

  await Promise.all(jobs.map(job =>
    importHistoryRepo.updateProgress(job.importId, {
      totalProducts: products.length,
      totalVariants,
      expectedUniqueProducts,
      duplicateHandleCount: duplicateHandles.length,
      duplicateRowCount: duplicateRows,
      noHandleCount,
      duplicateSamples
    })
  ));

  // Process each store sequentially (Bulk Ops only allows 1 set of ops per store at a time)
  for (const job of jobs) {
    await processStoreImport(job, products);
  }
}

/** Import products to a single store via Bulk Operations (up to 5 concurrent). */
/**
 * Publish products to all sales channels via bulk mutation.
 * Uses product IDs from bulk import results (no extra query needed).
 */
async function publishProducts(shopify, productIds, publicationIds, importId) {
  const {
    createStagedUpload, uploadToStagedTarget, runBulkMutation, pollBulkOperation
  } = await import('../../services/shopify-bulk-import-service.js');

  console.log(`[import:${importId}] Publishing ${productIds.length} products to ${publicationIds.length} channels...`);

  if (productIds.length === 0) {
    console.warn(`[import:${importId}] No product IDs to publish`);
    return;
  }

  try {
    // Build JSONL — each line: {"id": "gid://shopify/Product/xxx", "input": [{publicationId: "..."}]}
    const pubInput = publicationIds.map(id => ({publicationId: id}));
    const jsonl = productIds.map(id =>
      JSON.stringify({id, input: pubInput})
    ).join('\n');

    const fileSize = Buffer.byteLength(jsonl, 'utf8');
    console.log(`[import:${importId}] Publish JSONL: ${productIds.length} products, ${(fileSize / 1024).toFixed(0)}KB`);

    // Staged upload → bulk mutation → poll
    const target = await createStagedUpload(shopify, {
      filename: `publish-${importId}.jsonl`, fileSize
    });
    await uploadToStagedTarget(target, jsonl);
    const uploadPath = target.parameters.find(p => p.name === 'key')?.value || target.resourceUrl;

    const PUBLISH_MUTATION = 'mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }';
    const operation = await runBulkMutation(shopify, uploadPath, PUBLISH_MUTATION);
    console.log(`[import:${importId}] Publish bulk op started: ${operation.id}`);

    const result = await pollBulkOperation(shopify, operation.id, {maxWait: 1800000});
    console.log(`[import:${importId}] Publishing ${result.status}: ${productIds.length} products`);
  } catch (err) {
    console.error(`[import:${importId}] Publishing FAILED (likely missing write_publications scope): ${err.message}`, err.response?.errors || err.stack?.split('\n').slice(0, 3).join(' | '));
  }
}

/** Fetch all publication (sales channel) IDs for the store. */
async function fetchPublicationIds(shopify) {
  try {
    const result = await shopify.graphql(`{
      publications(first: 50) {
        nodes { id name }
      }
    }`);
    const nodes = result.publications?.nodes || [];
    if (nodes.length === 0) {
      console.warn('[import] fetchPublicationIds: returned 0 publications — store has no sales channels OR missing read_publications scope. Raw result:', JSON.stringify(result).slice(0, 300));
    } else {
      console.log(`[import] fetchPublicationIds: ${nodes.length} channels — ${nodes.map(n => n.name).join(', ')}`);
    }
    return nodes.map(n => n.id);
  } catch (err) {
    console.error('[import] fetchPublicationIds FAILED (likely missing read_publications scope):', err.message, err.response?.errors);
    return [];
  }
}

async function processStoreImport(job, products) {
  const {importId, storeId, storeName} = job;

  const store = await storeRepo.getById(storeId);
  if (!store?.accessToken) {
    await importHistoryRepo.markFailed(importId,
      `Missing access token for ${storeName}. Please reinstall the app.`);
    return;
  }

  const shopifyService = new ShopifyService({
    shopDomain: store.shopDomain, accessToken: store.accessToken
  });

  try {
    await shopifyService.verifyCredentials();
  } catch (err) {
    await importHistoryRepo.markFailed(importId,
      `Cannot connect to ${storeName}: ${err.message}`);
    return;
  }

  const total = products.length;
  console.log(`[import:${importId}] Starting: ${total} products → ${storeName}`);

  // Fetch all sales channel IDs for auto-publish after import
  const publicationIds = await fetchPublicationIds(shopifyService.shopify);
  console.log(`[import:${importId}] Will publish to ${publicationIds.length} sales channels after import`);

  await importHistoryRepo.updateProgress(importId, {
    status: 'processing',
    statusMessage: `Importing ${total} products to ${storeName}...`
  });

  try {
    // Track per-chunk objectCount so we can aggregate across parallel chunks
    const chunkCounts = new Map();
    const chunkStatuses = new Map();

    const result = await runConcurrentBulkImport(shopifyService.shopify, products, {
      importId,
      maxConcurrent: 5,
      onChunkProgress: ({chunkIndex, status, objectCount, totalInChunk}) => {
        chunkCounts.set(chunkIndex, Number(objectCount) || 0);
        chunkStatuses.set(chunkIndex, status);
        const aggregated = [...chunkCounts.values()].reduce((a, b) => a + b, 0);
        const summary = [...chunkStatuses.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([i, s]) => `c${i + 1}:${s}`)
          .join(' ');
        importHistoryRepo.updateProgress(importId, {
          status: 'processing',
          processedProducts: aggregated,
          statusMessage: `${aggregated}/${total} processed [${summary}]`
        }).catch(() => {});
      }
    });

    const {successCount, failedCount, errors, isVariantThrottled, productIds: importedIds} = result;

    if (isVariantThrottled) {
      const msg = `Daily variant limit reached for ${storeName}. ${successCount} imported, ${failedCount} remaining. Retry after midnight UTC.`;
      console.warn(`[import:${importId}] ${msg}`);
      await importHistoryRepo.markFailed(importId, msg, {
        failedProductDetails: errors,
        variantThrottled: true
      });
    } else if (failedCount >= total) {
      await importHistoryRepo.markFailed(importId, `All products failed to import to ${storeName}`, {
        failedProductDetails: errors
      });
    } else {
      // Auto-publish to all sales channels, then mark completed
      if (publicationIds.length > 0 && (importedIds?.length || 0) > 0) {
        await publishProducts(shopifyService.shopify, importedIds, publicationIds, importId);
      }
      await importHistoryRepo.markCompleted(importId, {
        successCount, failedCount, processedProducts: total,
        failedProductDetails: errors
      });
    }

    console.log(`[import:${importId}] ${storeName}: ${successCount} success, ${failedCount} failed`);
  } catch (error) {
    console.error(`[import:${importId}] ${storeName} error:`, error);
    await importHistoryRepo.markFailed(importId, `${storeName}: ${error.message}`);
  }
}
