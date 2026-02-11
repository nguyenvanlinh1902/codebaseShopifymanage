/**
 * Shop and Webhook Operations Module
 * Handles shop info and webhook-related Shopify API operations
 */

/**
 * Get shop info
 */
export async function getShopInfo() {
  try {
    const shop = await this.shopify.shop.get();
    return shop;
  } catch (error) {
    console.error('Error getting shop info:', error);
    throw new Error(`Failed to get shop info: ${error.message}`);
  }
}

/**
 * Verify shop credentials
 */
export async function verifyCredentials() {
  try {
    await this.getShopInfo();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create webhook
 */
export async function createWebhook(webhookData) {
  try {
    const webhook = await this.shopify.webhook.create(webhookData);
    return webhook;
  } catch (error) {
    console.error('Error creating webhook:', error);
    throw new Error(`Failed to create webhook: ${error.message}`);
  }
}

/**
 * List webhooks
 */
export async function listWebhooks() {
  try {
    const webhooks = await this.shopify.webhook.list();
    return webhooks;
  } catch (error) {
    console.error('Error listing webhooks:', error);
    throw new Error(`Failed to list webhooks: ${error.message}`);
  }
}

/**
 * Delete webhook
 */
export async function deleteWebhook(webhookId) {
  try {
    await this.shopify.webhook.delete(webhookId);
    return true;
  } catch (error) {
    console.error('Error deleting webhook:', error);
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }
}
