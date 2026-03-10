import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from '../services/shopifyService.js';

const storeRepo = new StoreRepository();

/**
 * GET /api/dev/orders?storeId=xxx&limit=3&orderNumber=xxx
 * Admin-only: fetch raw Shopify order data (including line_items.properties) for debugging.
 */
export async function getOrderData(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Admin access required'});
    }

    const {storeId, limit = '3', orderNumber} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    const shopifyService = new ShopifyService({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken
    });

    // Build query params — search by order name (e.g. "#1001") if provided
    const queryParams = {
      limit: Math.min(10, Math.max(1, parseInt(limit) || 3)),
      status: 'any'
    };
    if (orderNumber) {
      queryParams.name = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
    }

    const orders = await shopifyService.getOrders(queryParams);

    // Return only fields relevant for debugging: id, name, line_items (with properties), note
    const debugData = orders.map(o => ({
      id: o.id,
      name: o.name,
      note: o.note,
      line_items: (o.line_items || []).map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        variant_id: item.variant_id,
        properties: item.properties || []
      }))
    }));

    return res.json({
      success: true,
      data: debugData,
      store: {id: store.id, name: store.name, shopDomain: store.shopDomain},
      count: debugData.length
    });
  } catch (error) {
    console.error('[DevOrderInspector] Error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
