import {StoreRepository} from '../repositories/storeRepository.js';
import {runShopifyQL} from '../helpers/shopifyql-runner.js';

const storeRepo = new StoreRepository();

/**
 * GET /api/analytics/campaign-ads?storeId=xxx&since=startOfMonth(0m)&until=today&compareTo=previous_month
 * Fetch shop_campaign_insights (ad spend by day) for a single store.
 */
export async function getCampaignAds(req, res) {
  try {
    const {storeId, since = 'startOfMonth(0m)', until = 'today', compareTo = 'previous_month'} =
      req.query;

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required'});
    }

    const store = await storeRepo.getById(storeId);
    if (!store || !store.accessToken) {
      return res.status(404).json({success: false, error: 'Store not found or no access token'});
    }

    const parts = [
      'FROM shop_campaign_insights',
      'SHOW shop_campaign_ad_spend',
      'GROUP BY day',
      'TIMESERIES day',
      `SINCE ${since} UNTIL ${until}`,
      'ORDER BY day ASC'
    ];
    if (compareTo && compareTo !== 'none') {
      parts[2] = 'GROUP BY day WITH TOTALS, PERCENT_CHANGE';
      parts.splice(5, 0, `COMPARE TO ${compareTo}`);
    }
    const shopifyqlQuery = parts.join(' ');

    const result = await runShopifyQL(store.shopDomain, store.accessToken, shopifyqlQuery);

    if (result?.parseErrors?.length > 0) {
      return res.status(422).json({
        success: false,
        error: result.parseErrors.join('; '),
        parseErrors: result.parseErrors
      });
    }

    return res.json({
      success: true,
      data: {
        columns: result?.tableData?.columns || [],
        rows: result?.tableData?.rows || [],
        store: {id: store.id, name: store.name, shopDomain: store.shopDomain}
      }
    });
  } catch (error) {
    console.error('Campaign ads error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/analytics/campaign-ads/all-stores?since=...&until=...
 * Fetch campaign ad spend totals for ALL stores (total only, no daily breakdown).
 * Admin only.
 */
export async function getCampaignAdsAllStores(req, res) {
  try {
    const {since = 'startOfMonth(0m)', until = 'today'} = req.query;

    const allStores = await storeRepo.getAll();
    const activeStores = allStores.filter(s => s.status === 'active' && s.accessToken);

    const shopifyqlQuery = [
      'FROM shop_campaign_insights',
      'SHOW shop_campaign_ad_spend',
      'GROUP BY day WITH TOTALS',
      `SINCE ${since} UNTIL ${until}`,
      'ORDER BY day ASC'
    ].join(' ');

    const results = await Promise.all(
      activeStores.map(async store => {
        try {
          const result = await runShopifyQL(store.shopDomain, store.accessToken, shopifyqlQuery);
          if (result?.parseErrors?.length > 0) return {storeId: store.id, name: store.name, shopDomain: store.shopDomain, error: result.parseErrors[0]};
          return {
            storeId: store.id,
            name: store.name,
            shopDomain: store.shopDomain,
            columns: result?.tableData?.columns || [],
            rows: result?.tableData?.rows || []
          };
        } catch (err) {
          return {storeId: store.id, name: store.name, shopDomain: store.shopDomain, error: err.message};
        }
      })
    );

    return res.json({success: true, data: results});
  } catch (error) {
    console.error('Campaign ads all stores error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
