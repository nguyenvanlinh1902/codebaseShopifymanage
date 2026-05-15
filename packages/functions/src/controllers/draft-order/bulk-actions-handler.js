/**
 * Bulk Actions Handler — sync endpoints for duplicating and completing
 * multiple draft orders in one request. Sequential loop with throttle to
 * stay under Shopify GraphQL rate limits.
 */

import {shopifyGraphQL, validateStoreAccess} from '../../helpers/shopify-admin-graphql.js';
import {
  FETCH_DRAFT_FOR_CLONE_QUERY,
  DRAFT_ORDER_CREATE_MUTATION,
  DRAFT_ORDER_COMPLETE_MUTATION,
  buildDraftCloneInput,
  sleep
} from '../../services/draft-order-clone-service.js';

const MAX_OPS = 50;
const THROTTLE_MS = 250;

function normalizeIds(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map(id => String(id).trim())
    .filter(Boolean)
    .map(id => (id.startsWith('gid://') ? id : `gid://shopify/DraftOrder/${id}`));
}

function shortId(gid) {
  return gid?.split('/').pop() || gid;
}

/**
 * Run an async operation against each id sequentially with throttle.
 * Returns {results, errors}. One failure does not abort the loop.
 */
async function runSequential(ids, op) {
  const results = [];
  const errors = [];
  for (let i = 0; i < ids.length; i++) {
    const sourceId = ids[i];
    try {
      const result = await op(sourceId);
      results.push({sourceId: shortId(sourceId), ...result});
    } catch (err) {
      errors.push({sourceId: shortId(sourceId), message: err.message});
    }
    if (i < ids.length - 1) await sleep(THROTTLE_MS);
  }
  return {results, errors};
}

/**
 * POST /api/draft-orders/bulk-duplicate
 * Body: { storeId, sourceIds: string[], sourceStoreId? }
 * - storeId      = target store (where new drafts are created).
 * - sourceStoreId = optional. If provided & differs from storeId, fetches sources
 *                   from that store and creates clones on target store with
 *                   variantId/customerId stripped (cross-store).
 */
export async function bulkDuplicate(req, res) {
  try {
    const {storeId, sourceIds, sourceStoreId} = req.body || {};
    const ids = normalizeIds(sourceIds);
    if (!storeId) return res.status(400).json({success: false, error: 'storeId is required'});
    if (ids.length === 0) return res.status(400).json({success: false, error: 'sourceIds is required'});
    if (ids.length > MAX_OPS) {
      return res.status(400).json({success: false, error: `Max ${MAX_OPS} sources per request`});
    }

    const targetAccess = await validateStoreAccess(req, storeId);
    if (targetAccess.error) {
      return res.status(targetAccess.status).json({success: false, error: targetAccess.error});
    }

    const crossStore = sourceStoreId && sourceStoreId !== storeId;
    let sourceAccess = targetAccess;
    if (crossStore) {
      sourceAccess = await validateStoreAccess(req, sourceStoreId);
      if (sourceAccess.error) {
        return res.status(sourceAccess.status).json({success: false, error: sourceAccess.error});
      }
    }

    const {results, errors} = await runSequential(ids, async sourceId => {
      const fetchData = await shopifyGraphQL(sourceAccess.store, FETCH_DRAFT_FOR_CLONE_QUERY, {id: sourceId});
      if (!fetchData.draftOrder) throw new Error('Source draft not found');
      const input = buildDraftCloneInput(fetchData.draftOrder, {crossStore});

      const createData = await shopifyGraphQL(targetAccess.store, DRAFT_ORDER_CREATE_MUTATION, {input});
      const userErrors = createData.draftOrderCreate?.userErrors || [];
      if (userErrors.length > 0) throw new Error(userErrors[0].message);

      const draft = createData.draftOrderCreate?.draftOrder;
      return {newDraftId: shortId(draft.id), name: draft.name};
    });

    return res.json({
      success: true,
      data: {succeeded: results.length, failed: errors.length, results, errors}
    });
  } catch (err) {
    console.error('bulkDuplicate error:', err);
    return res.status(500).json({success: false, error: 'Internal error'});
  }
}

/**
 * POST /api/draft-orders/bulk-complete
 * Body: { storeId, sourceIds: string[] }
 * Marks each draft as paid (OPEN → COMPLETED, creates Order).
 */
export async function bulkComplete(req, res) {
  try {
    const {storeId, sourceIds} = req.body || {};
    const ids = normalizeIds(sourceIds);
    if (!storeId) return res.status(400).json({success: false, error: 'storeId is required'});
    if (ids.length === 0) return res.status(400).json({success: false, error: 'sourceIds is required'});
    if (ids.length > MAX_OPS) {
      return res.status(400).json({success: false, error: `Max ${MAX_OPS} sources per request`});
    }

    const access = await validateStoreAccess(req, storeId);
    if (access.error) return res.status(access.status).json({success: false, error: access.error});

    const {results, errors} = await runSequential(ids, async sourceId => {
      const data = await shopifyGraphQL(access.store, DRAFT_ORDER_COMPLETE_MUTATION, {
        id: sourceId,
        paymentPending: false
      });
      const userErrors = data.draftOrderComplete?.userErrors || [];
      if (userErrors.length > 0) throw new Error(userErrors[0].message);

      const draft = data.draftOrderComplete?.draftOrder;
      return {orderName: draft?.order?.name || draft?.name};
    });

    return res.json({
      success: true,
      data: {succeeded: results.length, failed: errors.length, results, errors}
    });
  } catch (err) {
    console.error('bulkComplete error:', err);
    return res.status(500).json({success: false, error: 'Internal error'});
  }
}
