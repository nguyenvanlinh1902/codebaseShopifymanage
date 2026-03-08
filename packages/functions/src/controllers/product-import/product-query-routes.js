/**
 * Product query route handlers
 */

import {ProductRepository} from '../../repositories/productRepository.js';

const productRepo = new ProductRepository();

/**
 * Get imported products with pagination and search
 * Decision tree:
 * - importId → getByImportId (single import)
 * - search → searchProducts via BigQuery (full-text search)
 * - otherwise → getWithPagination via Firestore (simple pagination)
 */
export async function getProducts(req, res) {
  try {
    const {storeId, importId, page, limit, search, vendor, store} = req.query;
    const userId = req.query.userId || 'default-user';

    if (!storeId && !importId) {
      // Fall through to get all products
    }

    // Handle import ID separately (no pagination needed usually)
    if (importId) {
      const products = await productRepo.getByImportId(importId);
      return res.json({
        success: true,
        data: products
      });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const searchQuery = search || '';

    // Parse filter arrays
    const vendors = vendor ? vendor.split(',').filter(Boolean) : [];
    const stores = store ? store.split(',').filter(Boolean) : [];

    // Decision tree: Use BigQuery if search or filters present
    if (searchQuery || vendors.length > 0 || stores.length > 0) {
      // Use BigQuery for better search performance
      const result = await productRepo.searchProducts({
        userId,
        search: searchQuery,
        vendors,
        stores,
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
      userId,
      storeId,
      page: pageNum,
      limit: limitNum,
      search: searchQuery
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
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get filter options (vendors and stores)
 */
export async function getProductFilterOptions(req, res) {
  try {
    const userId = req.query.userId || 'default-user';

    const options = await productRepo.getFilterOptions(userId);

    return res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Get product filter options error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
