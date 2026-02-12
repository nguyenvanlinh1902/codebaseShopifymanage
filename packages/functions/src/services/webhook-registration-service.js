import {ShopifyService} from './shopifyService.js';
import {OrderSyncRepository} from '../repositories/orderSyncRepository.js';

const orderSyncRepo = new OrderSyncRepository();

/**
 * Webhook topics to register on app install.
 * app/uninstalled and shop/update are managed via shopify.app.toml (Shopify auto-registers).
 */
function getWebhookTopics(baseUrl) {
  return [
    {topic: 'orders/create', address: `${baseUrl}/api/orders/webhook`},
    {topic: 'fulfillments/create', address: `${baseUrl}/api/fulfillments/webhook`},
    {topic: 'fulfillments/update', address: `${baseUrl}/api/fulfillments/webhook`},
    {topic: 'customers/create', address: `${baseUrl}/api/customers/webhook`},
    {topic: 'customers/update', address: `${baseUrl}/api/customers/webhook`}
  ];
}

/**
 * Register all app webhooks on install/reinstall.
 * Skips already-registered topics to avoid duplicates.
 */
export async function registerAppWebhooks(storeId, shopDomain, accessToken) {
  const baseUrl = process.env.FUNCTION_URL || process.env.APP_URL;
  if (!baseUrl) {
    console.error('[registerAppWebhooks] No FUNCTION_URL or APP_URL configured');
    return {registered: 0, skipped: 0, failed: 0};
  }

  const shopifyService = new ShopifyService({shopDomain, accessToken});
  const topics = getWebhookTopics(baseUrl);

  let existingWebhooks;
  try {
    existingWebhooks = await shopifyService.listWebhooks();
  } catch (err) {
    console.error('[registerAppWebhooks] Failed to list webhooks:', err.message);
    return {registered: 0, skipped: 0, failed: topics.length};
  }

  const results = {registered: 0, skipped: 0, failed: 0, details: []};

  for (const {topic, address} of topics) {
    const alreadyExists = existingWebhooks.some(
      wh => wh.topic === topic && wh.address === address
    );

    if (alreadyExists) {
      results.skipped++;
      continue;
    }

    try {
      const webhook = await shopifyService.createWebhook({topic, address, format: 'json'});

      // Save to Firestore for tracking
      await orderSyncRepo.registerWebhook({
        storeId,
        shopDomain,
        shopifyWebhookId: webhook.id,
        topic,
        address
      });

      results.registered++;
      results.details.push({topic, webhookId: webhook.id});
    } catch (err) {
      console.error(`[registerAppWebhooks] Failed to register ${topic}:`, err.message);
      results.failed++;
    }
  }

  console.log(`[registerAppWebhooks] ${shopDomain}: registered=${results.registered} skipped=${results.skipped} failed=${results.failed}`);
  return results;
}

/**
 * Clean up store data on uninstall.
 * Shopify auto-removes webhooks from their side, we only clean Firestore records.
 */
export async function cleanupStoreOnUninstall(storeId) {
  if (!storeId) return;

  try {
    // Delete local webhook records
    const webhooks = await orderSyncRepo.getWebhooksByStore(storeId);
    for (const webhook of webhooks) {
      await orderSyncRepo.deleteWebhook(webhook.id);
    }

    // Deactivate sync configs
    const syncConfigs = await orderSyncRepo.getSyncJobsByStore(storeId);
    for (const config of syncConfigs) {
      if (config.status === 'active') {
        await orderSyncRepo.updateSyncJob(config.id, {status: 'inactive'});
      }
    }

    console.log(`[cleanupStoreOnUninstall] Cleaned up store ${storeId}: ${webhooks.length} webhooks, ${syncConfigs.length} sync configs`);
  } catch (err) {
    console.error('[cleanupStoreOnUninstall] Error:', err.message);
  }
}
