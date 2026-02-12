import {OrderSyncRepository} from '../repositories/orderSyncRepository.js';

const orderSyncRepo = new OrderSyncRepository();

/**
 * Clean up store data on uninstall.
 * Shopify auto-removes webhooks from their side, we only clean Firestore records.
 * Webhooks are managed declaratively via shopify.app.toml (auto-registered on install).
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
