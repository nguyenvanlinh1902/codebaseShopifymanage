/**
 * Helper utilities for retry logic, rate limiting, and circuit breaking.
 */

/** Sleep helper for rate limiting */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Rate limit delay between Shopify API calls (ms) */
export const RATE_LIMIT_DELAY = 600;

const MAX_RETRIES = 5;
const MAX_BACKOFF_MS = 60000;
const CIRCUIT_BREAKER_THRESHOLD = 10;

// Module-level circuit breaker state (resets on function cold start)
let consecutive429s = 0;

/**
 * Check if the circuit breaker should stop processing.
 * Resets automatically when a non-429 error or success occurs.
 */
export function shouldCircuitBreak() {
  return consecutive429s >= CIRCUIT_BREAKER_THRESHOLD;
}

/** Reset circuit breaker counter (call on non-429 response) */
export function resetCircuitBreaker() {
  consecutive429s = 0;
}

/**
 * Check if an error indicates an expired/invalid access token.
 *
 * @param {Error} error
 * @returns {boolean}
 */
export function isTokenExpired(error) {
  const status = error.response?.statusCode || error.statusCode;
  if (status === 401) return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('unauthorized') || msg.includes('access token');
}

/**
 * Call Shopify API with retry on 429 (Too Many Requests).
 * Exponential backoff up to 60s, honours Retry-After header.
 * Applies circuit breaker after 10 consecutive 429s.
 *
 * @param {() => Promise<any>} fn
 * @param {number} [maxRetries]
 * @returns {Promise<any>}
 */
export async function callWithRetry(fn, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      resetCircuitBreaker();
      return result;
    } catch (error) {
      const is429 = error.statusCode === 429 || error.message?.includes('429');

      if (is429) {
        consecutive429s++;
        if (shouldCircuitBreak()) {
          throw new Error(
            `Circuit breaker open: ${consecutive429s} consecutive rate limit errors. Stop processing.`
          );
        }
        if (attempt < maxRetries) {
          const retryAfterHeader = error.response?.headers?.['retry-after'];
          const delay = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : Math.min(Math.pow(2, attempt + 1) * 1000, MAX_BACKOFF_MS);
          console.log(`Rate limited (429), waiting ${delay}ms before retry (attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(delay);
          continue;
        }
      } else {
        resetCircuitBreaker();
      }

      throw error;
    }
  }
}
