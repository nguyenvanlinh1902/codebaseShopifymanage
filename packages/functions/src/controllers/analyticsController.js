import {StoreRepository} from '../repositories/storeRepository.js';
import {OrderRepository} from '../repositories/orderRepository.js';
import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {TrackingHistoryRepository} from '../repositories/trackingHistoryRepository.js';

const storeRepo = new StoreRepository();
const orderRepo = new OrderRepository();
const importHistoryRepo = new ImportHistoryRepository();
const trackingHistoryRepo = new TrackingHistoryRepository();

/**
 * Get analytics data: order counts, order status breakdown, import stats per store
 */
export async function getAnalytics(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    const isStandalone = userId === 'default-user';
    const stores = isStandalone ? await storeRepo.getAll() : await storeRepo.getByUser(userId);

    // Fetch per-store order stats and import history in parallel
    const [storeOrderStats, productImports, trackingImports] = await Promise.all([
      Promise.all(
        stores.map(async store => {
          const [syncStats, orders] = await Promise.all([
            orderRepo.getSyncStats(store.id).catch(() => ({total: 0, syncedToSheet: 0, failedToSync: 0})),
            orderRepo.getOrdersByStore(store.id, 500).catch(() => [])
          ]);

          // Group orders by date (last 30 days)
          const now = new Date();
          const last30Days = new Date(now);
          last30Days.setDate(last30Days.getDate() - 30);

          const ordersByDate = {};
          orders.forEach(order => {
            const date = order.orderDate
              ? new Date(order.orderDate).toISOString().split('T')[0]
              : null;
            if (date && new Date(date) >= last30Days) {
              ordersByDate[date] = (ordersByDate[date] || 0) + 1;
            }
          });

          return {
            storeId: store.id,
            storeName: store.name,
            shopDomain: store.shopDomain,
            orderStats: syncStats,
            ordersByDate
          };
        })
      ),
      isStandalone ? importHistoryRepo.getAll() : importHistoryRepo.getByUser(userId),
      isStandalone ? trackingHistoryRepo.getAll() : trackingHistoryRepo.getByUser(userId)
    ]);

    // Aggregate totals across stores
    const totalOrders = storeOrderStats.reduce((sum, s) => sum + s.orderStats.total, 0);
    const totalSynced = storeOrderStats.reduce((sum, s) => sum + s.orderStats.syncedToSheet, 0);
    const totalFailed = storeOrderStats.reduce((sum, s) => sum + s.orderStats.failedToSync, 0);
    const totalPending = totalOrders - totalSynced - totalFailed;

    // Product import stats
    const productImportStats = {
      total: productImports.length,
      completed: 0,
      processing: 0,
      failed: 0,
      pending: 0,
      totalProducts: 0
    };
    productImports.forEach(imp => {
      if (imp.status === 'completed') productImportStats.completed++;
      else if (imp.status === 'processing') productImportStats.processing++;
      else if (imp.status === 'failed') productImportStats.failed++;
      else productImportStats.pending++;
      productImportStats.totalProducts += imp.results?.successCount || imp.results?.totalProcessed || 0;
    });

    // Tracking import stats
    const trackingImportStats = {
      total: trackingImports.length,
      completed: 0,
      processing: 0,
      failed: 0,
      pending: 0,
      totalUpdated: 0,
      totalTrackingFailed: 0
    };
    trackingImports.forEach(imp => {
      if (imp.status === 'completed') trackingImportStats.completed++;
      else if (imp.status === 'processing') trackingImportStats.processing++;
      else if (imp.status === 'failed') trackingImportStats.failed++;
      else trackingImportStats.pending++;
      trackingImportStats.totalUpdated += imp.successCount || imp.results?.successCount || 0;
      trackingImportStats.totalTrackingFailed += imp.failedCount || 0;
    });

    // Merge ordersByDate across all stores for chart
    const mergedOrdersByDate = {};
    storeOrderStats.forEach(s => {
      Object.entries(s.ordersByDate).forEach(([date, count]) => {
        mergedOrdersByDate[date] = (mergedOrdersByDate[date] || 0) + count;
      });
    });

    // Sort dates and build chart data
    const sortedDates = Object.keys(mergedOrdersByDate).sort();
    const orderTrend = sortedDates.map(date => ({
      date,
      count: mergedOrdersByDate[date]
    }));

    // Recent tracking imports with details
    const recentTracking = trackingImports.slice(0, 20).map(imp => ({
      id: imp.id,
      storeName: imp.storeName || 'Unknown',
      fileName: imp.fileName,
      status: imp.status,
      totalRecords: imp.totalRecords || 0,
      processedRecords: imp.processedRecords || 0,
      successCount: imp.successCount || imp.results?.successCount || 0,
      failedCount: imp.failedCount || 0,
      createdAt: imp.createdAt,
      completedAt: imp.completedAt
    }));

    // Recent product imports with details
    const recentProducts = productImports.slice(0, 20).map(imp => ({
      id: imp.id,
      storeName: imp.storeName || 'Unknown',
      fileName: imp.fileName,
      status: imp.status,
      totalRecords: imp.totalRecords || 0,
      processedRecords: imp.processedRecords || 0,
      successCount: imp.results?.successCount || 0,
      failedCount: (imp.results?.totalProcessed || 0) - (imp.results?.successCount || 0),
      createdAt: imp.createdAt,
      completedAt: imp.completedAt
    }));

    return res.json({
      success: true,
      data: {
        orderSummary: {
          total: totalOrders,
          synced: totalSynced,
          failed: totalFailed,
          pending: totalPending > 0 ? totalPending : 0
        },
        ordersByStore: storeOrderStats.map(s => ({
          storeName: s.storeName,
          shopDomain: s.shopDomain,
          ...s.orderStats
        })),
        orderTrend,
        productImportStats,
        trackingImportStats,
        recentTracking,
        recentProducts
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
