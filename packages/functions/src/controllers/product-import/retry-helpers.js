/**
 * Helper utilities for retry logic and rate limiting
 */

/** Sleep helper for rate limiting */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Rate limit delay between Shopify API calls (ms) */
export const RATE_LIMIT_DELAY = 600;

/**
 * Call Shopify API with retry on 429 (Too Many Requests)
 * Exponential backoff: 2s, 4s, 8s
 */
export async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const is429 = error.statusCode === 429 || error.message?.includes('429');
      if (is429 && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.log(`Rate limited (429), waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
}
