/**
 * Handle app/uninstalled webhook
 * @param ctx
 * @returns {Promise<{success: boolean}>}
 */
export async function appUninstalled(ctx) {
  try {
    const shopifyDomain = ctx.get('X-Shopify-Shop-Domain');
    // TODO: Handle app uninstallation logic here
    // Example: Mark shop as uninstalled, cleanup data, etc.
    console.log(`App uninstalled for shop: ${shopifyDomain}`);

    return (ctx.body = {
      success: true
    });
  } catch (e) {
    console.error(e);
    return (ctx.body = {
      success: false,
      error: e.message
    });
  }
}

// Add more webhook handlers here
// Example:
// export async function listenNewOrder(ctx) {
//   try {
//     const shopifyDomain = ctx.get('X-Shopify-Shop-Domain');
//     const orderData = ctx.req.body;
//     // Handle order logic here
//     return (ctx.body = { success: true });
//   } catch (e) {
//     console.error(e);
//     return (ctx.body = { success: false });
//   }
// }
