import {StoreRepository} from '../repositories/storeRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {runShopifyQL} from '../helpers/shopifyql-runner.js';
import shopifyConfig from '../config/shopify.js';
import {extractStoreIds, hasStoreAccess} from '../utils/store-access.js';

const storeRepo = new StoreRepository();
const adminUserRepo = new AdminUserRepository();

/**
 * GET /api/analytics/order-analytics?storeId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Fetch real order analytics from Shopify via ShopifyQL + GraphQL.
 * Uses explicit date range so numbers match Dashboard's client-side calculations.
 */
export async function getOrderAnalytics(req, res) {
  try {
    const {storeId, timezone} = req.query;
    let {from, to} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    // Default to last 30 days if no dates provided
    if (!from || !to) {
      to = getTodayInTimezone(timezone);
      const d = new Date(to + 'T00:00:00');
      d.setDate(d.getDate() - 30);
      from = d.toISOString().split('T')[0];
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({success: false, error: 'Invalid date format. Use YYYY-MM-DD'});
    }

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    // Permission check for non-admin users
    if (req.userRole !== 'admin') {
      const userRecord = await adminUserRepo.getById(req.userId);
      if (!hasStoreAccess(userRecord?.assignedStores, storeId)) {
        return res.status(403).json({success: false, error: 'Access denied to this store'});
      }
    }

    // ShopifyQL uses 'sales' dataset (not 'orders')
    // Use explicit ISO dates so results match Dashboard's client-side filtering
    const [summaryResult, timeSeriesResult, statusBreakdown] = await Promise.all([
      runShopifyQL(
        store.shopDomain,
        store.accessToken,
        `FROM sales SHOW net_sales, total_sales, orders SINCE ${from} UNTIL ${to}`
      ),
      runShopifyQL(
        store.shopDomain,
        store.accessToken,
        `FROM sales SHOW net_sales, total_sales, orders GROUP BY day SINCE ${from} UNTIL ${to} ORDER BY day ASC`
      ),
      fetchOrderStatusBreakdown(store, from)
    ]);

    const summary = parseSummary(summaryResult);
    const timeSeries = parseTimeSeries(timeSeriesResult);

    return res.json({
      success: true,
      data: {
        summary,
        byStatus: statusBreakdown,
        timeSeries,
        store: {id: store.id, name: store.name, shopDomain: store.shopDomain}
      }
    });
  } catch (error) {
    console.error('Order analytics error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Fetch order fulfillment status breakdown via GraphQL Admin API.
 */
async function fetchOrderStatusBreakdown(store, sinceDate) {
  try {
    const query = `{
      fulfilled: ordersCount(query: "fulfillment_status:shipped created_at:>=${sinceDate}") { count }
      unfulfilled: ordersCount(query: "fulfillment_status:unshipped created_at:>=${sinceDate}") { count }
      partial: ordersCount(query: "fulfillment_status:partial created_at:>=${sinceDate}") { count }
    }`;

    const response = await fetch(
      `https://${store.shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json'},
        body: JSON.stringify({query})
      }
    );

    if (!response.ok) return {};
    const json = await response.json();
    const data = json?.data || {};
    return {
      fulfilled: data.fulfilled?.count || 0,
      unfulfilled: data.unfulfilled?.count || 0,
      partial: data.partial?.count || 0
    };
  } catch (err) {
    console.error('[OrderAnalytics] Status breakdown error:', err.message);
    return {};
  }
}

/** Get "today" date string in the user's timezone (YYYY-MM-DD) */
function getTodayInTimezone(timezone) {
  if (!timezone) return new Date().toISOString().split('T')[0];
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    return parts; // en-CA gives YYYY-MM-DD format
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * GET /api/analytics/order-analytics-batch?storeIds=id1,id2&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Batch fetch analytics for multiple stores in one request.
 */
export async function getOrderAnalyticsBatch(req, res) {
  try {
    const {storeIds, timezone} = req.query;
    let {from, to} = req.query;

    if (!storeIds) {
      return res.status(400).json({success: false, error: 'storeIds is required'});
    }

    const ids = storeIds.split(',').filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({success: false, error: 'No valid storeIds provided'});
    }

    if (!from || !to) {
      to = getTodayInTimezone(timezone);
      const d = new Date(to + 'T00:00:00');
      d.setDate(d.getDate() - 30);
      from = d.toISOString().split('T')[0];
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({success: false, error: 'Invalid date format. Use YYYY-MM-DD'});
    }

    // Permission check: non-admin must have access to all requested stores
    let permittedIds = ids;
    if (req.userRole !== 'admin') {
      const userRecord = await adminUserRepo.getById(req.userId);
      const userStoreIds = extractStoreIds(userRecord?.assignedStores);
      permittedIds = ids.filter(id => userStoreIds.includes(id));
    }

    // Fetch all stores in parallel
    const stores = await Promise.all(permittedIds.map(id => storeRepo.getById(id)));
    const validStores = stores.filter(s => s && s.accessToken);

    // Query all stores in parallel (each store runs 3 queries internally)
    const results = await Promise.all(
      validStores.map(async store => {
        try {
          const [summaryResult, timeSeriesResult, statusBreakdown] = await Promise.all([
            runShopifyQL(store.shopDomain, store.accessToken,
              `FROM sales SHOW net_sales, total_sales, orders SINCE ${from} UNTIL ${to}`),
            runShopifyQL(store.shopDomain, store.accessToken,
              `FROM sales SHOW net_sales, total_sales, orders GROUP BY day SINCE ${from} UNTIL ${to} ORDER BY day ASC`),
            fetchOrderStatusBreakdown(store, from)
          ]);
          return {
            summary: parseSummary(summaryResult),
            byStatus: statusBreakdown,
            timeSeries: parseTimeSeries(timeSeriesResult),
            store: {id: store.id, name: store.name, shopDomain: store.shopDomain}
          };
        } catch (err) {
          console.error(`[BatchAnalytics] Error for store ${store.id}:`, err.message);
          return null;
        }
      })
    );

    const validResults = results.filter(Boolean);

    // Aggregate
    const summary = {totalOrders: 0, totalRevenue: 0, totalSales: 0, avgOrderValue: 0};
    const statusMap = {};
    const timeMap = {};

    for (const r of validResults) {
      summary.totalOrders += r.summary.totalOrders || 0;
      summary.totalRevenue += r.summary.totalRevenue || 0;
      summary.totalSales += r.summary.totalSales || 0;

      if (r.byStatus) {
        for (const [k, v] of Object.entries(r.byStatus)) {
          statusMap[k] = (statusMap[k] || 0) + v;
        }
      }
      if (r.timeSeries) {
        for (const row of r.timeSeries) {
          if (!timeMap[row.date]) timeMap[row.date] = {date: row.date, orders: 0, revenue: 0, totalSales: 0};
          timeMap[row.date].orders += row.orders || 0;
          timeMap[row.date].revenue += row.revenue || 0;
          timeMap[row.date].totalSales += row.totalSales || 0;
        }
      }
    }

    summary.avgOrderValue = summary.totalOrders > 0
      ? Math.round((summary.totalRevenue / summary.totalOrders) * 100) / 100
      : 0;

    return res.json({
      success: true,
      data: {
        summary,
        byStatus: statusMap,
        timeSeries: Object.values(timeMap).sort((a, b) => a.date.localeCompare(b.date)),
        storesQueried: validResults.length
      }
    });
  } catch (error) {
    console.error('Batch analytics error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

function parseSummary(result) {
  if (result?.parseErrors?.length > 0) {
    console.error('[OrderAnalytics] Summary parseErrors:', result.parseErrors);
    return {totalOrders: 0, totalRevenue: 0, avgOrderValue: 0};
  }
  const rows = result?.tableData?.rows || [];
  if (rows.length === 0) return {totalOrders: 0, totalRevenue: 0, avgOrderValue: 0};

  // Rows are objects with column names as keys
  const row = rows[0];
  const totalRevenue = parseFloat(row.net_sales || 0);
  const totalSales = parseFloat(row.total_sales || 0);
  const totalOrders = parseInt(row.orders || 0);
  const avgOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

  return {totalOrders, totalRevenue, totalSales, avgOrderValue};
}

function parseTimeSeries(result) {
  if (result?.parseErrors?.length > 0) {
    console.error('[OrderAnalytics] TimeSeries parseErrors:', result.parseErrors);
    return [];
  }
  const rows = result?.tableData?.rows || [];

  // Rows are objects: {day: "2026-03-01", net_sales: "483.82", orders: "5"}
  return rows.map(row => ({
    date: row.day || '',
    orders: parseInt(row.orders || 0),
    revenue: parseFloat(row.net_sales || 0),
    totalSales: parseFloat(row.total_sales || 0)
  }));
}
