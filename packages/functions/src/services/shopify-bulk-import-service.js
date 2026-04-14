/**
 * Shopify Bulk Operations Import Service
 * Orchestrates: staged upload → bulk mutation → poll → parse results.
 */
import fetch from 'node-fetch';
import FormData from 'form-data';

import {buildProductJsonl} from './shopify-bulk-product-jsonl-builder.js';
export {buildProductJsonl};

// ─── Staged Upload ────────────────────────────────────────────────────────────

const STAGED_UPLOADS_MUTATION = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }`;

/**
 * Create a staged upload target for JSONL bulk mutation variables.
 */
export async function createStagedUpload(shopify, {filename = 'bulk-import.jsonl', fileSize}) {
  const result = await shopify.graphql(STAGED_UPLOADS_MUTATION, {
    input: [{
      resource: 'BULK_MUTATION_VARIABLES',
      filename,
      mimeType: 'text/jsonl',
      httpMethod: 'POST',
      fileSize: fileSize ? String(fileSize) : undefined
    }]
  });

  const {stagedTargets, userErrors} = result.stagedUploadsCreate;
  if (userErrors?.length > 0) {
    throw new Error(`stagedUploadsCreate failed: ${userErrors.map(e => e.message).join('; ')}`);
  }
  return stagedTargets[0];
}

/**
 * Upload JSONL content to the staged target via multipart POST.
 * Retries once on network failure.
 */
export async function uploadToStagedTarget(target, jsonlContent) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const form = new FormData();
      for (const {name, value} of target.parameters) {
        form.append(name, value);
      }
      form.append('file', Buffer.from(jsonlContent), {
        filename: 'bulk-import.jsonl',
        contentType: 'text/jsonl'
      });

      const response = await fetch(target.url, {method: 'POST', body: form, timeout: 120000});
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Upload failed (${response.status}): ${text.slice(0, 200)}`);
      }
      return;
    } catch (err) {
      if (attempt === 1) throw err;
      console.warn(`Staged upload attempt ${attempt + 1} failed, retrying: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ─── Bulk Mutation ────────────────────────────────────────────────────────────

const PRODUCT_SET_MUTATION_STR =
  'mutation productSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers) { productSet(input: $input, identifier: $identifier, synchronous: false) { product { id title } userErrors { field message code } } }';

const RUN_BULK_MUTATION = `
  mutation bulkOperationRunMutation($mutation: String!, $stagedUploadPath: String!) {
    bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
      bulkOperation { id status }
      userErrors { field message }
    }
  }`;

/**
 * Start a bulk productSet mutation.
 * Retries up to 3 times with backoff if another bulk operation is running.
 */
export async function runBulkMutation(shopify, stagedUploadPath) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await shopify.graphql(RUN_BULK_MUTATION, {
      mutation: PRODUCT_SET_MUTATION_STR,
      stagedUploadPath
    });

    const {bulkOperation, userErrors} = result.bulkOperationRunMutation;
    if (!userErrors?.length) return bulkOperation;

    const isRunning = userErrors.some(e => e.message?.toLowerCase().includes('already running'));
    if (isRunning && attempt < 2) {
      const delay = (attempt + 1) * 15000; // 15s, 30s
      console.warn(`Bulk operation busy, waiting ${delay / 1000}s before retry...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    throw new Error(`bulkOperationRunMutation: ${userErrors.map(e => e.message).join('; ')}`);
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

const POLL_QUERY = `
  query pollBulkOp($id: ID!) {
    node(id: $id) {
      ... on BulkOperation {
        id status objectCount url errorCode
      }
    }
  }`;

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED']);

/**
 * Poll bulk operation until terminal state.
 * Uses adaptive interval: starts fast (3s), slows down over time (up to 15s).
 * onProgress callback receives {status, objectCount} for real-time updates.
 */
export async function pollBulkOperation(shopify, operationId, {maxWait = 1800000, onProgress} = {}) {
  const deadline = Date.now() + maxWait;
  let interval = 3000;

  while (Date.now() < deadline) {
    const result = await shopify.graphql(POLL_QUERY, {id: operationId});
    const op = result?.node;
    if (!op) throw new Error(`Bulk operation ${operationId} not found`);

    if (onProgress) onProgress({status: op.status, objectCount: op.objectCount || 0});

    if (TERMINAL.has(op.status)) {
      return {status: op.status, objectCount: op.objectCount, url: op.url, errorCode: op.errorCode};
    }

    await new Promise(r => setTimeout(r, interval));
    interval = Math.min(interval + 1000, 15000); // ramp up: 3s → 4s → ... → 15s
  }

  throw new Error(`Bulk operation timed out after ${maxWait / 1000}s`);
}

// ─── Results Parser ───────────────────────────────────────────────────────────

/**
 * Download and parse bulk operation result JSONL.
 * Returns {successCount, failedCount, errors: [{title, message}]}.
 */
export async function downloadBulkResults(resultUrl) {
  const response = await fetch(resultUrl, {timeout: 60000});
  if (!response.ok) throw new Error(`Failed to download results (${response.status})`);

  const text = await response.text();
  const lines = text.split('\n').filter(Boolean);

  // Log first line for debugging response format
  if (lines.length > 0) {
    console.log(`[bulk-import] Results: ${lines.length} lines, first: ${lines[0].slice(0, 300)}`);
  } else {
    console.log('[bulk-import] Results: empty (0 lines)');
  }

  let successCount = 0;
  let failedCount = 0;
  const errors = [];

  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      const data = item?.data?.productSet || item?.productSet;
      if (!data) continue;

      const userErrors = data.userErrors || [];
      if (userErrors.length > 0) {
        failedCount++;
        const title = data.product?.title || `Product ${successCount + failedCount}`;
        const details = userErrors.map(e => ({
          field: e.field?.join('.') || '',
          message: e.message || '',
          code: e.code || ''
        }));
        console.error(`[bulk-import] Failed: "${title}" →`, JSON.stringify(details));
        errors.push({
          title,
          message: details.map(d => `[${d.code}] ${d.field}: ${d.message}`).join('; '),
          details
        });
      } else {
        successCount++;
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Detect daily variant throttle
  const isVariantThrottled = errors.some(e =>
    e.message?.includes('Daily variant creation limit') ||
    e.details?.some(d => d.code === 'VARIANT_THROTTLE_EXCEEDED')
  );

  return {successCount, failedCount, errors, isVariantThrottled};
}

// ─── Concurrent Bulk Import ─────────────────────────────────────────────────

/**
 * Run up to 5 concurrent bulk operations for a product list.
 * Splits products into chunks, each chunk gets its own staged upload + bulk mutation.
 * API 2026-04 supports 5 concurrent bulk ops per store.
 */
export async function runConcurrentBulkImport(shopify, products, {
  maxConcurrent = 5,
  importId = '',
  onChunkProgress
} = {}) {
  const chunkCount = Math.min(maxConcurrent, products.length);
  const chunkSize = Math.ceil(products.length / chunkCount);
  const chunks = [];
  for (let i = 0; i < products.length; i += chunkSize) {
    chunks.push(products.slice(i, i + chunkSize));
  }

  console.log(`[import:${importId}] Splitting ${products.length} products into ${chunks.length} chunks`);

  // Stagger start by 500ms to avoid rate-limit burst on staged uploads
  const results = await Promise.allSettled(
    chunks.map((chunk, idx) =>
      delay(idx * 500).then(() =>
        processChunk(shopify, chunk, idx, importId, onChunkProgress)
      )
    )
  );

  return aggregateResults(results, chunks);
}

/** Process a single chunk through the full bulk import pipeline. */
async function processChunk(shopify, chunk, chunkIndex, importId, onChunkProgress) {
  const label = `[import:${importId}:chunk${chunkIndex}]`;

  const jsonl = buildProductJsonl(chunk);
  const fileSize = Buffer.byteLength(jsonl, 'utf8');
  console.log(`${label} JSONL built: ${chunk.length} products, ${(fileSize / 1024).toFixed(0)}KB`);

  // Staged upload
  const target = await createStagedUpload(shopify, {
    filename: `import-${importId}-chunk${chunkIndex}.jsonl`,
    fileSize
  });
  await uploadToStagedTarget(target, jsonl);

  const uploadPath = target.parameters.find(p => p.name === 'key')?.value || target.resourceUrl;

  // Bulk mutation
  const operation = await runBulkMutation(shopify, uploadPath);
  console.log(`${label} Bulk op started: ${operation.id}`);

  // Poll with progress
  const result = await pollBulkOperation(shopify, operation.id, {
    maxWait: 1800000,
    onProgress: ({status, objectCount}) => {
      onChunkProgress?.({chunkIndex, status, objectCount, totalInChunk: chunk.length});
    }
  });

  // Parse results
  if (result.status !== 'COMPLETED') {
    throw new Error(`Chunk ${chunkIndex} ${result.status}${result.errorCode ? `: ${result.errorCode}` : ''}`);
  }

  if (result.url) {
    return await downloadBulkResults(result.url);
  }
  return {successCount: chunk.length, failedCount: 0, errors: []};
}

/** Aggregate results from all chunks (handles rejected promises). */
function aggregateResults(settledResults, chunks) {
  let successCount = 0;
  let failedCount = 0;
  const errors = [];

  for (let i = 0; i < settledResults.length; i++) {
    const result = settledResults[i];
    if (result.status === 'fulfilled') {
      successCount += result.value.successCount;
      failedCount += result.value.failedCount;
      errors.push(...result.value.errors);
    } else {
      // Entire chunk failed — use actual chunk size
      failedCount += chunks[i].length;
      const errMsg = result.reason?.message || 'Unknown error';
      console.error(`[bulk-import] Chunk ${i} failed:`, result.reason);
      errors.push({title: `Chunk ${i} failure`, message: errMsg});
    }
  }

  return {successCount, failedCount, errors: errors.slice(0, 100)};
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
