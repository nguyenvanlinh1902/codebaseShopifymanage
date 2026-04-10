/**
 * Policy template helpers.
 * Hardcoded defaults under ./policy-templates/ are used as fallback
 * when no custom template is saved in the database.
 */
import {REFUND_TEMPLATE} from './policy-templates/refund-policy-template';
import {SHIPPING_TEMPLATE} from './policy-templates/shipping-policy-template';
import {TERMS_TEMPLATE} from './policy-templates/terms-of-service-template';
import {PRIVACY_TEMPLATE} from './policy-templates/privacy-policy-template';
import {CONTACT_TEMPLATE} from './policy-templates/contact-information-template';

/** Hardcoded defaults — used when DB has no custom template */
export const DEFAULT_TEMPLATES = {
  REFUND_POLICY: REFUND_TEMPLATE,
  SHIPPING_POLICY: SHIPPING_TEMPLATE,
  TERMS_OF_SERVICE: TERMS_TEMPLATE,
  PRIVACY_POLICY: PRIVACY_TEMPLATE,
  CONTACT_INFORMATION: CONTACT_TEMPLATE
};

/**
 * Replace placeholders in a template string.
 */
function replacePlaceholders(template, storeName, email) {
  const now = new Date();
  const lastUpdated = now.toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});
  return template
    .replace(/\{\{storeName\}\}/g, storeName)
    .replace(/\{\{email\}\}/g, email)
    .replace(/\{\{lastUpdated\}\}/g, lastUpdated);
}

/**
 * Generate all 5 policy HTML strings.
 * @param {string} storeName - Store display name
 * @param {string} email - Support email address
 * @param {Object} [customTemplates] - DB templates keyed by type, overrides defaults
 */
export function generatePolicies(storeName, email, customTemplates = {}) {
  const result = {};
  for (const [type, defaultBody] of Object.entries(DEFAULT_TEMPLATES)) {
    const template = customTemplates[type] || defaultBody;
    result[type] = replacePlaceholders(template, storeName, email);
  }
  return result;
}
