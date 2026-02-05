import {google} from 'googleapis';
import {GOOGLE_SHEETS_CONFIG} from '../config/googleSheets.js';

/**
 * Google Sheets Service
 * Handles all interactions with Google Sheets API
 */
export class GoogleSheetsService {
  constructor(credentials) {
    this.auth = null;
    this.sheets = null;
    if (credentials) {
      this.initializeAuth(credentials);
    }
  }

  /**
   * Initialize Google Sheets API with OAuth2 credentials
   */
  initializeAuth(credentials) {
    this.auth = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );

    if (credentials.accessToken) {
      this.auth.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken
      });
    }

    this.sheets = google.sheets({version: 'v4', auth: this.auth});
  }

  /**
   * Get authorization URL for OAuth2 flow
   */
  getAuthUrl() {
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SHEETS_CONFIG.scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code) {
    const {tokens} = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    return tokens;
  }

  /**
   * Read data from a sheet
   * @param {string} spreadsheetId - The ID of the spreadsheet
   * @param {string} range - The A1 notation range (e.g., 'Products!A1:Z1000')
   */
  async readSheet(spreadsheetId, range) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Error reading sheet:', error);
      throw new Error(`Failed to read sheet: ${error.message}`);
    }
  }

  /**
   * Parse product data from sheet rows
   * Assumes first row is header
   */
  parseProducts(rows) {
    if (!rows || rows.length === 0) {
      return [];
    }

    const headers = rows[0];
    const products = [];

    // Find column indexes
    const colIndexes = {};
    Object.keys(GOOGLE_SHEETS_CONFIG.productColumns).forEach(key => {
      const colName = GOOGLE_SHEETS_CONFIG.productColumns[key];
      colIndexes[key] = headers.findIndex(h => h === colName);
    });

    // Parse each row (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const product = {};

      Object.keys(colIndexes).forEach(key => {
        const idx = colIndexes[key];
        if (idx !== -1 && row[idx]) {
          product[key] = row[idx];
        }
      });

      // Skip empty rows
      if (product.title) {
        products.push(product);
      }
    }

    return products;
  }

  /**
   * Write data to a sheet
   * @param {string} spreadsheetId - The ID of the spreadsheet
   * @param {string} range - The A1 notation range
   * @param {Array} values - 2D array of values to write
   */
  async writeSheet(spreadsheetId, range, values) {
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error writing to sheet:', error);
      throw new Error(`Failed to write to sheet: ${error.message}`);
    }
  }

  /**
   * Append data to a sheet
   * @param {string} spreadsheetId - The ID of the spreadsheet
   * @param {string} range - The A1 notation range
   * @param {Array} values - 2D array of values to append
   */
  async appendSheet(spreadsheetId, range, values) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error appending to sheet:', error);
      throw new Error(`Failed to append to sheet: ${error.message}`);
    }
  }

  /**
   * Format orders for export to Google Sheets
   */
  formatOrdersForExport(orders) {
    const headers = Object.values(GOOGLE_SHEETS_CONFIG.orderColumns);
    const rows = [headers];

    orders.forEach(order => {
      const row = [
        order.id,
        order.order_number || order.name,
        order.email,
        order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : '',
        order.phone || order.customer?.phone || '',
        order.financial_status,
        order.fulfillment_status,
        order.total_price,
        order.currency,
        order.line_items?.map(item => `${item.name} x${item.quantity}`).join('; ') || '',
        order.shipping_address
          ? `${order.shipping_address.address1}, ${order.shipping_address.city}, ${order.shipping_address.province}, ${order.shipping_address.country}`
          : '',
        order.created_at,
        order.storeId || ''
      ];
      rows.push(row);
    });

    return rows;
  }

  /**
   * Parse tracking data from sheet rows
   */
  parseTrackingData(rows) {
    if (!rows || rows.length === 0) {
      return [];
    }

    const headers = rows[0];
    const trackingData = [];

    // Find column indexes
    const colIndexes = {};
    Object.keys(GOOGLE_SHEETS_CONFIG.trackingColumns).forEach(key => {
      const colName = GOOGLE_SHEETS_CONFIG.trackingColumns[key];
      colIndexes[key] = headers.findIndex(h => h === colName);
    });

    // Parse each row (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const tracking = {};

      Object.keys(colIndexes).forEach(key => {
        const idx = colIndexes[key];
        if (idx !== -1 && row[idx]) {
          tracking[key] = row[idx];
        }
      });

      // Skip empty rows or already processed
      if (tracking.orderId && tracking.trackingNumber && tracking.status !== 'Updated') {
        trackingData.push(tracking);
      }
    }

    return trackingData;
  }

  /**
   * Get spreadsheet info
   */
  async getSpreadsheetInfo(spreadsheetId) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId
      });

      return {
        title: response.data.properties.title,
        sheets: response.data.sheets.map(sheet => ({
          title: sheet.properties.title,
          sheetId: sheet.properties.sheetId
        }))
      };
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
      throw new Error(`Failed to get spreadsheet info: ${error.message}`);
    }
  }
}
