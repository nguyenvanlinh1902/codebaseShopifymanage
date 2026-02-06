import {StoreRepository} from '../repositories/storeRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {OrderSyncRepository} from '../repositories/orderSyncRepository.js';
import {OrderRepository} from '../repositories/orderRepository.js';
import {ImportHistoryRepository} from '../repositories/importHistoryRepository.js';
import {TrackingHistoryRepository} from '../repositories/trackingHistoryRepository.js';

const storeRepo = new StoreRepository();
const sheetRepo = new SheetRepository();
const orderSyncRepo = new OrderSyncRepository();
const orderRepo = new OrderRepository();
const importHistoryRepo = new ImportHistoryRepository();
const trackingHistoryRepo = new TrackingHistoryRepository();

/**
 * Get aggregated dashboard stats for multi-store management
 */
export async function getDashboardStats(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    // Fetch stores and sheets in parallel
    const [stores, sheets] = await Promise.all([
      storeRepo.getByUser(userId),
      sheetRepo.getByUserId(userId)
    ]);

    // Fetch per-store data in parallel
    const storeDetails = await Promise.all(
      stores.map(async store => {
        const [syncConfigs, syncStats, orderCount] = await Promise.all([
          orderSyncRepo.getSyncJobsByStore(store.id).catch(() => []),
          orderRepo.getSyncStats(store.id).catch(() => ({total: 0, syncedToSheet: 0, failedToSync: 0})),
          orderRepo.getOrdersCount(store.id).catch(() => 0)
        ]);

        const activeConfig = syncConfigs.find(c => c.status === 'active');
        const webhooks = await orderSyncRepo.getWebhooksByStore(store.id).catch(() => []);

        return {
          id: store.id,
          name: store.name,
          shopDomain: store.shopDomain,
          status: store.status || 'active',
          niche: store.niche || '',
          syncConfig: activeConfig
            ? {
                status: activeConfig.status,
                sheetName: activeConfig.sheetName,
                targetSheet: activeConfig.targetSheet,
                totalOrdersSynced: activeConfig.totalOrdersSynced || 0,
                lastSyncAt: activeConfig.lastSyncAt || null
              }
            : null,
          orderStats: {
            total: syncStats.total || 0,
            syncedToSheet: syncStats.syncedToSheet || 0,
            failedToSync: syncStats.failedToSync || 0
          },
          webhookActive: webhooks.length > 0,
          webhookCount: webhooks.length
        };
      })
    );

    // Fetch import history
    let recentImports = [];
    let recentTracking = [];
    try {
      recentImports = await importHistoryRepo.getByUser(userId);
      recentImports = recentImports.slice(0, 10);
    } catch (e) {
      // ignore
    }
    try {
      recentTracking = await trackingHistoryRepo.getByUser(userId);
      recentTracking = recentTracking.slice(0, 10);
    } catch (e) {
      // ignore
    }

    // Aggregate totals
    const totals = storeDetails.reduce(
      (acc, store) => {
        acc.totalOrders += store.orderStats.total;
        acc.totalSynced += store.orderStats.syncedToSheet;
        acc.totalFailed += store.orderStats.failedToSync;
        acc.totalOrdersSynced += store.syncConfig?.totalOrdersSynced || 0;
        if (store.webhookActive) acc.activeWebhooks++;
        if (store.syncConfig) acc.activeSyncConfigs++;
        return acc;
      },
      {
        totalOrders: 0,
        totalSynced: 0,
        totalFailed: 0,
        totalOrdersSynced: 0,
        activeWebhooks: 0,
        activeSyncConfigs: 0
      }
    );

    // Product import totals
    const productImportStats = recentImports.reduce(
      (acc, imp) => {
        if (imp.status === 'completed') acc.completed++;
        else if (imp.status === 'failed') acc.failed++;
        else acc.pending++;
        acc.totalProducts += imp.results?.successCount || imp.results?.totalProcessed || 0;
        return acc;
      },
      {completed: 0, failed: 0, pending: 0, totalProducts: 0}
    );

    // Tracking import totals
    const trackingImportStats = recentTracking.reduce(
      (acc, imp) => {
        if (imp.status === 'completed') acc.completed++;
        else if (imp.status === 'failed') acc.failed++;
        else acc.pending++;
        acc.totalUpdated += imp.results?.successCount || 0;
        return acc;
      },
      {completed: 0, failed: 0, pending: 0, totalUpdated: 0}
    );

    // Build recent activity feed
    const activities = [];

    // Add recent order syncs
    storeDetails.forEach(store => {
      if (store.syncConfig?.lastSyncAt) {
        activities.push({
          type: 'order_sync',
          store: store.name,
          message: `Synced ${store.syncConfig.totalOrdersSynced} orders`,
          timestamp: store.syncConfig.lastSyncAt
        });
      }
    });

    // Add recent product imports
    recentImports.slice(0, 5).forEach(imp => {
      activities.push({
        type: 'product_import',
        store: imp.storeName || 'Unknown',
        message: `Product import ${imp.status} - ${imp.results?.successCount || 0} products`,
        status: imp.status,
        timestamp: imp.completedAt || imp.createdAt
      });
    });

    // Add recent tracking updates
    recentTracking.slice(0, 5).forEach(imp => {
      activities.push({
        type: 'tracking_update',
        store: imp.storeName || 'Unknown',
        message: `Tracking import ${imp.status} - ${imp.results?.successCount || 0} updated`,
        status: imp.status,
        timestamp: imp.completedAt || imp.createdAt
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
      return dateB - dateA;
    });

    return res.json({
      success: true,
      data: {
        overview: {
          totalStores: stores.length,
          activeStores: stores.filter(s => s.status === 'active' || !s.status).length,
          totalSheets: sheets.length,
          ...totals
        },
        stores: storeDetails,
        productImports: productImportStats,
        trackingImports: trackingImportStats,
        recentActivity: activities.slice(0, 15),
        recentImports: recentImports.slice(0, 5),
        recentTracking: recentTracking.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
