import {StoreRepository} from '../repositories/storeRepository.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {runShopifyQL} from '../helpers/shopifyql-runner.js';
import shopifyConfig from '../config/shopify.js';
import {extractStoreIds, hasStoreAccess} from '../utils/store-access.js';

const storeRepo = new StoreRepository();
const adminUserRepo = new AdminUserRepository();

const ALLOWED_SINCE = ['-1d', '-7d', '-30d', '-90d', '-365d', 'startOfMonth(0m)', 'startOfYear(0y)'];
const DEFAULT_SINCE = '-30d';

/**
 * GET /api/analytics/order-analytics?storeId=xxx&since=-30d
 * Fetch real order analytics from Shopify via ShopifyQL + GraphQL.
 */
export async function getOrderAnalytics(req, res) {
  try {
    const {storeId, timezone} = req.query;
    let {since = DEFAULT_SINCE} = req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }
    if (!ALLOWED_SINCE.includes(since)) since = DEFAULT_SINCE;

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
    // Columns: net_sales, gross_sales, total_sales, orders, returns, discounts
    const [summaryResult, timeSeriesResult, statusBreakdown] = await Promise.all([
      runShopifyQL(store.shopDomain, store.accessToken,
        `FROM sales SHOW net_sales, total_sales, orders SINCE ${since} UNTIL today`
      ),
      runShopifyQL(store.shopDomain, store.accessToken,
        `FROM sales SHOW net_sales, total_sales, orders GROUP BY day SINCE ${since} UNTIL today ORDER BY day ASC`
      ),
      fetchOrderStatusBreakdown(store, since, timezone)
    ]);

    const summary = parseSummary(summaryResult);
    const timeSeries = parseTimeSeries(timeSeriesResult);

    return res.json({
      success: true,
      data: {summary, byStatus: statusBreakdown, timeSeries, store: {id: store.id, name: store.name, shopDomain: store.shopDomain}}
    });
  } catch (error) {
    console.error('Order analytics error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Fetch order fulfillment status breakdown via GraphQL Admin API.
 */
async function fetchOrderStatusBreakdown(store, since, timezone) {
  try {
    const sinceDate = resolveSinceDate(since, timezone);
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
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
    return parts; // en-CA gives YYYY-MM-DD format
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function resolveSinceDate(since, timezone) {
  const todayStr = getTodayInTimezone(timezone);
  const today = new Date(todayStr + 'T00:00:00');

  if (since === '-1d') return new Date(today - 86400000).toISOString().split('T')[0];
  if (since === '-7d') return new Date(today - 7 * 86400000).toISOString().split('T')[0];
  if (since === '-30d') return new Date(today - 30 * 86400000).toISOString().split('T')[0];
  if (since === '-90d') return new Date(today - 90 * 86400000).toISOString().split('T')[0];
  if (since === '-365d') return new Date(today - 365 * 86400000).toISOString().split('T')[0];
  if (since === 'startOfMonth(0m)') return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  if (since === 'startOfYear(0y)') return new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
  return new Date(today - 30 * 86400000).toISOString().split('T')[0];
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
