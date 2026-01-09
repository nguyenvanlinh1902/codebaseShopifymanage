/**
 * API Manager
 *
 * Handles all API requests to the backend.
 * Uses XMLHttpRequest for maximum browser compatibility.
 */

import {makeRequest} from '../helpers/api';

export default class ApiManager {
  constructor() {
    this.shopDomain = window.Shopify?.shop || '';
    this.apiUrl = process.env.API_URL || '';
  }

  /**
   * Get widget data from API
   * Falls back to window data if available (set by Liquid)
   */
  async getWidgetData() {
    // Option 1: Use data embedded in page by Liquid (faster, no API call)
    if (window.__avadaWidgetData) {
      return window.__avadaWidgetData;
    }

    // Option 2: Fetch from API (when data can't be embedded)
    if (!this.shopDomain) {
      console.warn('[Avada] Shop domain not found');
      return null;
    }

    try {
      const url = `${this.apiUrl}/clientApi/widget?shopifyDomain=${this.shopDomain}`;
      const response = await makeRequest(url);
      return response;
    } catch (error) {
      console.error('[Avada] API request failed:', error);
      return null;
    }
  }

  /**
   * Track an event (e.g., widget displayed, clicked)
   */
  async trackEvent(eventType, eventData = {}) {
    if (!this.apiUrl) return;

    try {
      await makeRequest(
        `${this.apiUrl}/clientApi/track`,
        'POST',
        {
          shopDomain: this.shopDomain,
          eventType,
          ...eventData
        },
        {contentType: 'application/json'}
      );
    } catch (error) {
      // Silent fail for tracking
      console.warn('[Avada] Tracking failed:', error);
    }
  }
}
