/**
 * Product query route handlers
 */

import {ProductRepository} from '../../repositories/productRepository.js';
import {AdminUserRepository} from '../../repositories/adminUserRepository.js';
import {extractStoreIds} from '../../utils/store-access.js';

const productRepo = new ProductRepository();
const adminUserRepo = new AdminUserRepository();

/**
 * Get permitted store IDs for request user.
 * Returns null for admin (all stores), array of IDs for non-admin.
 */
async function getPermittedStoreIds(req) {
  if (req.userRole === 'admin') return null;
  const userRecord = await adminUserRepo.getById(req.userId);
  return extractStoreIds(userRecord?.assignedStores);
}

/**
 * Get imported products with pagination and search
 * Decision tree:
 * - importId → getByImportId (single import)
 * - search/filters → searchProducts via BigQuery (full-text search)
 * - otherwise → getWithPagination via Firestore (simple pagination)
 * Access: admin = all products, non-admin = products in assigned stores only
 */
export async function getProducts(req, res) {
  try {
    const {storeId, importId, page, limit, search, vendor, store, status} = req.query;

    // Handle import ID separately (no pagination needed usually)
    if (importId) {
      const products = await productRepo.getByImportId(importId);
      return res.json({success: true, data: products});
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const searchQuery = search || '';

    // Parse filter arrays
    const vendors = vendor ? vendor.split(',').filter(Boolean) : [];
    const stores = store ? store.split(',').filter(Boolean) : [];

    // Determine access scope: admin = null (all), non-admin = assigned store IDs
    const permittedStoreIds = await getPermittedStoreIds(req);

    // Non-admin with no assigned stores → return empty
    if (permittedStoreIds !== null && permittedStoreIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {page: pageNum, limit: limitNum, total: 0, totalPages: 0}
      });
    }

    // Decision tree: Use BigQuery if search or filters present
    if (searchQuery || vendors.length > 0 || stores.length > 0 || status) {
      const result = await productRepo.searchProducts({
        permittedStoreIds,
        storeId,
        search: searchQuery,
        vendors,
        stores,
        status: status || '',
        page: pageNum,
        limit: limitNum
      });

      return res.json({
        success: true,
        data: result.products,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    }

    // No search/filters: Use fast Firestore pagination
    const result = await productRepo.getWithPagination({
      permittedStoreIds,
      storeId,
      status: status || '',
      page: pageNum,
      limit: limitNum
    });

    return res.json({
      success: true,
      data: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Get filter options (vendors and stores)
 */
export async function getProductFilterOptions(req, res) {
  try {
    const permittedStoreIds = await getPermittedStoreIds(req);

    const options = await productRepo.getFilterOptions(permittedStoreIds);

    return res.json({success: true, data: options});
  } catch (error) {
    console.error('Get product filter options error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
