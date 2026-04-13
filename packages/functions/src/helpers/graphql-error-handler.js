/**
 * GraphQL error handler — validates mutation responses for userErrors.
 * Reusable across product import and collections pipelines.
 */

/**
 * Check all top-level keys of a GraphQL mutation result for userErrors.
 * Throws if any non-empty userErrors array is found.
 *
 * @param {object} result - Raw GraphQL response object
 * @param {string} operationName - Name of the operation (for error messages)
 * @returns {object} The original result if no errors
 */
export function validateGraphqlResult(result, operationName) {
  if (!result) {
    throw new Error(`${operationName}: empty response from Shopify`);
  }

  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val && Array.isArray(val.userErrors) && val.userErrors.length > 0) {
      const messages = val.userErrors.map(e => e.message).join('; ');
      throw new Error(`${operationName} userErrors: ${messages}`);
    }
  }

  return result;
}
