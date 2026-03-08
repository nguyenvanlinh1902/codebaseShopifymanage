import {StoreRepository} from '../repositories/storeRepository.js';
import {OrderRepository} from '../repositories/orderRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';

const storeRepo = new StoreRepository();
const orderRepo = new OrderRepository();
const adminUserRepo = new AdminUserRepository();
const sheetRepo = new SheetRepository();

/**
 * GET /api/analytics/store-stats?storeId=xxx
 * Per-store analytics: order summary, order trend (30 days), sheet configs
 */
export async function getStoreAnalytics(req, res) {
  try {
    const {storeId} = req.query;
    const userId = req.userId;
    const isAdmin = req.userRole === 'admin';

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    // Access check for non-admin
    if (!isAdmin) {
      const user = await adminUserRepo.getById(userId);
      const assigned = user?.assignedStores || [];
      if (assigned.length > 0 && !assigned.includes(storeId)) {
        return res.status(403).json({success: false, error: 'Access denied to this store'});
      }
    }

    const store = await storeRepo.getById(storeId);
    if (!store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    // Fetch order stats + recent orders for trend in parallel
    const [syncStats, orders, sheets] = await Promise.all([
      orderRepo.getSyncStats(storeId).catch(() => ({total: 0, syncedToSheet: 0, failedToSync: 0})),
      orderRepo.getOrdersByStore(storeId, 500).catch(() => []),
      sheetRepo.getAll().catch(() => [])
    ]);

    // Build 30-day order trend
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const trendMap = {};
    for (const order of orders) {
      const date = order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : null;
      if (date && new Date(date) >= last30Days) {
        trendMap[date] = (trendMap[date] || 0) + 1;
      }
    }
    const orderTrend = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({date, count}));

    const pending = Math.max(0, syncStats.total - syncStats.syncedToSheet - syncStats.failedToSync);

    // Filter sheets by storeId if sheets have storeId field, otherwise return all
    const storeSheets = sheets.filter(s => !s.storeId || s.storeId === storeId);

    return res.json({
      success: true,
      data: {
        store: {id: store.id, name: store.name, shopDomain: store.shopDomain, status: store.status},
        orderSummary: {
          total: syncStats.total,
          synced: syncStats.syncedToSheet,
          failed: syncStats.failedToSync,
          pending
        },
        orderTrend,
        sheetConfigs: storeSheets.map(s => ({
          id: s.id,
          name: s.spreadsheetName || s.name || s.id,
          status: s.status || 'connected'
        }))
      }
    });
  } catch (error) {
    console.error('getStoreAnalytics error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
