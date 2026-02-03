import Shopify from '@shopify/shopify-api';
import organizationRepository from '../repositories/organizationRepository';
import {encrypt, decrypt} from '../helpers/encryption';

const REQUIRED_SCOPES = [
  'read_customers',
  'read_orders',
  'read_products',
  'read_fulfillments'
];

/**
 * Service for managing Shopify OAuth connections
 */
const shopifyAuthService = {
  /**
   * Generate the OAuth authorization URL
   * @param {Object} params
   * @param {string} params.shop - Shopify shop domain (e.g., mystore.myshopify.com)
   * @param {string} params.organizationId
   * @param {string} params.redirectUri
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  async getAuthorizationUrl({shop, organizationId, redirectUri}) {
    try {
      // Validate shop domain
      if (!shop || !shop.includes('.myshopify.com')) {
        return {
          success: false,
          error: 'Invalid Shopify store domain'
        };
      }

      // Create state parameter with org ID for callback verification
      const state = Buffer.from(
        JSON.stringify({
          organizationId,
          timestamp: Date.now()
        })
      ).toString('base64');

      const scopes = REQUIRED_SCOPES.join(',');
      const apiKey = process.env.SHOPIFY_API_KEY;

      const authUrl =
        `https://${shop}/admin/oauth/authorize?` +
        `client_id=${apiKey}&` +
        `scope=${scopes}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      return {
        success: true,
        data: authUrl
      };
    } catch (error) {
      console.error('OAuth URL generation error:', error);
      return {
        success: false,
        error: 'Failed to generate authorization URL'
      };
    }
  },

  /**
   * Exchange authorization code for access token
   * @param {Object} params
   * @param {string} params.shop
   * @param {string} params.code
   * @param {string} params.state
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async exchangeCodeForToken({shop, code, state}) {
    try {
      // Decode and validate state
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      } catch {
        return {success: false, error: 'Invalid state parameter'};
      }

      // Check state timestamp (10 minute expiry)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        return {success: false, error: 'Authorization request expired'};
      }

      const {organizationId} = stateData;

      // Exchange code for access token
      const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token exchange error:', errorData);
        return {
          success: false,
          error: 'Failed to exchange authorization code'
        };
      }

      const tokenData = await response.json();
      const {access_token, scope} = tokenData;

      // Validate we got required scopes
      const grantedScopes = scope.split(',');
      const missingScopes = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s));

      if (missingScopes.length > 0) {
        return {
          success: false,
          error: `Missing required permissions: ${missingScopes.join(', ')}`
        };
      }

      // Encrypt and store access token
      const encryptedToken = encrypt(access_token);

      // Update organization with Shopify connection
      await organizationRepository.update(organizationId, {
        shopifyDomain: shop,
        shopifyAccessToken: encryptedToken,
        shopifyScopes: grantedScopes,
        shopifyConnectedAt: new Date().toISOString()
      });

      return {
        success: true,
        data: {
          shop,
          scopes: grantedScopes,
          organizationId
        }
      };
    } catch (error) {
      console.error('Token exchange error:', error);
      return {
        success: false,
        error: 'Failed to complete Shopify connection'
      };
    }
  },

  /**
   * Get decrypted access token for an organization
   * @param {string} organizationId
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  async getAccessToken(organizationId) {
    try {
      const organization = await organizationRepository.getById(organizationId);

      if (!organization?.shopifyAccessToken) {
        return {
          success: false,
          error: 'Shopify not connected'
        };
      }

      const accessToken = decrypt(organization.shopifyAccessToken);

      return {
        success: true,
        data: accessToken
      };
    } catch (error) {
      console.error('Get access token error:', error);
      return {
        success: false,
        error: 'Failed to retrieve access token'
      };
    }
  },

  /**
   * Disconnect Shopify from organization
   * @param {string} organizationId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async disconnect(organizationId) {
    try {
      await organizationRepository.update(organizationId, {
        shopifyDomain: null,
        shopifyAccessToken: null,
        shopifyScopes: null,
        shopifyConnectedAt: null,
        shopifyLastSyncAt: null
      });

      return {success: true};
    } catch (error) {
      console.error('Disconnect error:', error);
      return {
        success: false,
        error: 'Failed to disconnect Shopify'
      };
    }
  },

  /**
   * Get connection status for an organization
   * @param {string} organizationId
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async getConnectionStatus(organizationId) {
    try {
      const organization = await organizationRepository.getById(organizationId);

      if (!organization) {
        return {success: false, error: 'Organization not found'};
      }

      const isConnected = !!organization.shopifyAccessToken;

      return {
        success: true,
        data: {
          isConnected,
          shop: organization.shopifyDomain || null,
          scopes: organization.shopifyScopes || [],
          connectedAt: organization.shopifyConnectedAt || null,
          lastSyncAt: organization.shopifyLastSyncAt || null
        }
      };
    } catch (error) {
      console.error('Get connection status error:', error);
      return {
        success: false,
        error: 'Failed to get connection status'
      };
    }
  },

  /**
   * Get required scopes for the app
   * @returns {string[]}
   */
  getRequiredScopes() {
    return REQUIRED_SCOPES;
  }
};

export default shopifyAuthService;
