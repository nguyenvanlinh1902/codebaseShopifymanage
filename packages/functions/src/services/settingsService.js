import * as organizationRepository from '@functions/repositories/organizationRepository';
import * as userRepository from '@functions/repositories/userRepository';

/**
 * Get organization settings
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{organization: Organization, settings: OrganizationSettings}>}
 */
export async function getSettings(organizationId) {
  const organization = await organizationRepository.getById(organizationId);

  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      shopifyDomain: organization.shopifyDomain,
      emailAddress: organization.emailAddress,
      timezone: organization.timezone,
      onboardingStatus: organization.onboardingStatus
    },
    settings: organization.settings
  };
}

/**
 * Update general settings
 *
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Settings to update
 * @param {string} [data.name] - Organization name
 * @param {string} [data.timezone] - Timezone
 * @returns {Promise<Organization>}
 */
export async function updateGeneralSettings(organizationId, data) {
  const updateData = {};

  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Organization name is required');
    }
    updateData.name = data.name.trim();
  }

  if (data.timezone !== undefined) {
    updateData.timezone = data.timezone;
  }

  if (Object.keys(updateData).length === 0) {
    return organizationRepository.getById(organizationId);
  }

  return organizationRepository.update(organizationId, updateData);
}

/**
 * Update email settings
 *
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Email settings
 * @param {string} [data.supportEmailName] - Support email display name
 * @param {string} [data.emailSignature] - Plain text signature
 * @param {string} [data.replyToEmail] - Reply-to email address
 * @returns {Promise<Organization>}
 */
export async function updateEmailSettings(organizationId, data) {
  const settings = {};

  if (data.supportEmailName !== undefined) {
    settings.supportEmailName = data.supportEmailName;
  }

  if (data.emailSignature !== undefined) {
    settings.emailSignature = data.emailSignature;
  }

  if (data.replyToEmail !== undefined) {
    // Validate email format
    if (data.replyToEmail && !isValidEmail(data.replyToEmail)) {
      throw new Error('Invalid reply-to email address');
    }
    settings.replyToEmail = data.replyToEmail;
  }

  if (Object.keys(settings).length === 0) {
    return organizationRepository.getById(organizationId);
  }

  return organizationRepository.updateSettings(organizationId, settings);
}

/**
 * Update auto-close settings
 *
 * @param {string} organizationId - Organization ID
 * @param {number} autoCloseAfterDays - Days after resolved to auto-close (0 to disable)
 * @returns {Promise<Organization>}
 */
export async function updateAutoCloseSettings(organizationId, autoCloseAfterDays) {
  if (autoCloseAfterDays < 0) {
    throw new Error('Auto-close days must be 0 or positive');
  }

  return organizationRepository.updateSettings(organizationId, {
    autoCloseAfterDays
  });
}

/**
 * Get Shopify connection status
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{connected: boolean, domain: string|null, lastSyncAt: Date|null}>}
 */
export async function getShopifyStatus(organizationId) {
  const organization = await organizationRepository.getById(organizationId);

  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    connected: organization.onboardingStatus?.shopifyConnected || false,
    domain: organization.shopifyDomain || null,
    lastSyncAt: organization.lastShopifySyncAt || null
  };
}

/**
 * Update user profile
 *
 * @param {string} userId - User ID
 * @param {Object} data - Profile data
 * @param {string} [data.name] - User name
 * @param {string} [data.avatarUrl] - Avatar URL
 * @returns {Promise<User>}
 */
export async function updateUserProfile(userId, data) {
  const updateData = {};

  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Name is required');
    }
    updateData.name = data.name.trim();
  }

  if (data.avatarUrl !== undefined) {
    updateData.avatarUrl = data.avatarUrl;
  }

  if (Object.keys(updateData).length === 0) {
    return userRepository.getById(userId);
  }

  return userRepository.update(userId, updateData);
}

/**
 * Update user notification preferences
 *
 * @param {string} userId - User ID
 * @param {Object} preferences - Notification preferences
 * @param {boolean} [preferences.emailOnAssignment] - Email on assignment
 * @param {boolean} [preferences.emailOnCustomerReply] - Email on customer reply
 * @returns {Promise<User>}
 */
export async function updateNotificationPreferences(userId, preferences) {
  return userRepository.updateNotificationPreferences(userId, preferences);
}

/**
 * Validate email format
 *
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get available timezones
 *
 * @returns {Array<{value: string, label: string}>}
 */
export function getTimezones() {
  return [
    {value: 'UTC', label: 'UTC (Coordinated Universal Time)'},
    {value: 'America/New_York', label: 'Eastern Time (US & Canada)'},
    {value: 'America/Chicago', label: 'Central Time (US & Canada)'},
    {value: 'America/Denver', label: 'Mountain Time (US & Canada)'},
    {value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)'},
    {value: 'America/Anchorage', label: 'Alaska'},
    {value: 'Pacific/Honolulu', label: 'Hawaii'},
    {value: 'Europe/London', label: 'London'},
    {value: 'Europe/Paris', label: 'Paris'},
    {value: 'Europe/Berlin', label: 'Berlin'},
    {value: 'Asia/Tokyo', label: 'Tokyo'},
    {value: 'Asia/Shanghai', label: 'Shanghai'},
    {value: 'Asia/Singapore', label: 'Singapore'},
    {value: 'Australia/Sydney', label: 'Sydney'},
    {value: 'Australia/Melbourne', label: 'Melbourne'}
  ];
}
