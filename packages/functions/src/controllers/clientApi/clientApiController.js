/**
 * Health check endpoint for client API
 * @param ctx
 * @returns {Promise<{success: boolean, timestamp: string}>}
 */
export async function health(ctx) {
  return (ctx.body = {
    success: true,
    timestamp: new Date().toISOString()
  });
}

// Add more client API handlers here
// Example:
// export async function getData(ctx) {
//   try {
//     const { shopifyDomain } = ctx.query;
//     // Fetch and return data for the storefront
//     return (ctx.body = {
//       data: [],
//       success: true
//     });
//   } catch (e) {
//     return (ctx.body = {
//       data: [],
//       error: e.message
//     });
//   }
// }
