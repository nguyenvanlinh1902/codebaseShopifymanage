/**
 * Delay Helper
 *
 * Promise-based delay for async operations.
 */

/**
 * Delay execution for specified milliseconds
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default delay;
