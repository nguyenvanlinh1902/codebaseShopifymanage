import {StoreRepository} from '../repositories/storeRepository.js';
import shopifyConfig from '../config/shopify.js';

const storeRepo = new StoreRepository();

// Fetch both shop-level alerts AND recent critical/important events
const ALERTS_QUERY = `{
  shop {
    alerts { action { title url } description }
  }
  events(first: 20, reverse: true, query: "verb:confirmed OR verb:cancelled OR verb:authorization_failure OR verb:capture_failure OR verb:refund_failure OR verb:sale_failure OR verb:void_failure") {
    nodes {
      ... on BasicEvent {
        id
        action
        message
        createdAt
        criticalAlert
        subjectType
      }
    }
  }
}`;

/**
 * Run GraphQL query for a single store to get alerts + events.
 */
async function fetchStoreAlertsAndEvents(shopDomain, accessToken) {
  try {
    const res = await fetch(
      `https://${shopDomain}.myshopify.com/admin/api/${shopifyConfig.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({query: ALERTS_QUERY})
      }
    );

    if (!res.ok) return {alerts: [], events: []};

    const data = await res.json();
    if (data?.errors) {
      console.error(`[Alerts] GraphQL errors for ${shopDomain}:`, data.errors.map(e => e.message).join('; '));
    }

    const alerts = data?.data?.shop?.alerts || [];
    const events = (data?.data?.events?.nodes || []).map(e => ({
      id: e.id,
      action: e.action,
      message: e.message,
      createdAt: e.createdAt,
      critical: e.criticalAlert,
      subjectType: e.subjectType
    }));

    return {alerts, events};
  } catch (err) {
    console.error(`[Alerts] Error for ${shopDomain}:`, err.message);
    return {alerts: [], events: []};
  }
}

/**
 * GET /api/analytics/alerts
 * Fetch shop alerts + recent events for all active stores.
 */
export async function getAllAlerts(req, res) {
  try {
    const allStores = await storeRepo.getAll();
    const activeStores = allStores.filter(s => s.status === 'active' && s.accessToken && s.shopDomain);

    const results = await Promise.all(
      activeStores.map(async store => {
        const {alerts, events} = await fetchStoreAlertsAndEvents(store.shopDomain, store.accessToken);
        return {storeId: store.id, shopDomain: store.shopDomain, name: store.name, alerts, events};
      })
    );

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Get all alerts error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
