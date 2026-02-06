import {google} from 'googleapis';
import {GOOGLE_SHEETS_CONFIG, GOOGLE_OAUTH_CONFIG} from '../config/googleSheets.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';

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
   * Factory: create a service instance using centralized per-user auth
   * googleapis auto-refreshes access_token using the stored refresh_token
   */
  static async createForUser(userId) {
    const authRepo = new GoogleAuthRepository();
    const authRecord = await authRepo.getByUserId(userId);

    if (!authRecord) {
      throw new Error('User not authenticated with Google. Please connect your Google account.');
    }

    const service = new GoogleSheetsService();
    service.initializeAuth({
      clientId: GOOGLE_OAUTH_CONFIG.clientId,
      clientSecret: GOOGLE_OAUTH_CONFIG.clientSecret,
      redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
      refreshToken: authRecord.refreshToken
    });

    return service;
  }

  /**
   * Factory: create a service instance from a per-sheet refresh token
   * googleapis auto-refreshes access_token when needed
   */
  static async createFromRefreshToken(refreshToken) {
    const service = new GoogleSheetsService();
    service.initializeAuth({
      clientId: GOOGLE_OAUTH_CONFIG.clientId,
      clientSecret: GOOGLE_OAUTH_CONFIG.clientSecret,
      redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
      refreshToken
    });

    return service;
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

    if (credentials.refreshToken) {
      this.auth.setCredentials({
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

  /**
   * Write orders to Google Sheets with headers
   */
  async writeOrders(spreadsheetId, sheetName, orders) {
    try {
      // Create headers
      const headers = [
        'Order Number',
        'Order ID',
        'Order Date',
        'Order Status',
        'Fulfillment Status',
        'Total Price',
        'Currency',
        'Payment Method',
        'Customer ID',
        'Customer Email',
        'Customer Phone',
        'Customer First Name',
        'Customer Last Name',
        'Customer Full Name',
        'Shipping Name',
        'Shipping Address 1',
        'Shipping Address 2',
        'Shipping City',
        'Shipping Province',
        'Shipping Zip',
        'Shipping Country',
        'Shipping Phone',
        'Billing Name',
        'Billing Address 1',
        'Billing City',
        'Billing Province',
        'Billing Zip',
        'Billing Country',
        'Items Count',
        'Items',
        'Tracking Numbers',
        'Tracking URLs',
        'Note',
        'Tags',
        'Created At',
        'Updated At'
      ];

      // Convert orders to rows
      const rows = orders.map(order => [
        order.orderNumber,
        order.orderId,
        order.orderDate,
        order.orderStatus,
        order.fulfillmentStatus,
        order.totalPrice,
        order.currency,
        order.paymentMethod,
        order.customerId,
        order.customerEmail,
        order.customerPhone,
        order.customerFirstName,
        order.customerLastName,
        order.customerFullName,
        order.shippingName,
        order.shippingAddress1,
        order.shippingAddress2,
        order.shippingCity,
        order.shippingProvince,
        order.shippingZip,
        order.shippingCountry,
        order.shippingPhone,
        order.billingName,
        order.billingAddress1,
        order.billingCity,
        order.billingProvince,
        order.billingZip,
        order.billingCountry,
        order.itemsCount,
        order.items,
        order.trackingNumbers,
        order.trackingUrls,
        order.note,
        order.tags,
        order.createdAt,
        order.updatedAt
      ]);

      // Write headers + data
      const allRows = [headers, ...rows];
      await this.writeSheet(spreadsheetId, `${sheetName}!A1`, allRows);

      return {success: true, rowsWritten: rows.length};
    } catch (error) {
      console.error('Error writing orders:', error);
      throw new Error(`Failed to write orders: ${error.message}`);
    }
  }

  /**
   * Append single order to sheet
   */
  async appendOrder(spreadsheetId, sheetName, order) {
    try {
      const row = [
        order.orderNumber,
        order.orderId,
        order.orderDate,
        order.orderStatus,
        order.fulfillmentStatus,
        order.totalPrice,
        order.currency,
        order.paymentMethod,
        order.customerId,
        order.customerEmail,
        order.customerPhone,
        order.customerFirstName,
        order.customerLastName,
        order.customerFullName,
        order.shippingName,
        order.shippingAddress1,
        order.shippingAddress2,
        order.shippingCity,
        order.shippingProvince,
        order.shippingZip,
        order.shippingCountry,
        order.shippingPhone,
        order.billingName,
        order.billingAddress1,
        order.billingCity,
        order.billingProvince,
        order.billingZip,
        order.billingCountry,
        order.itemsCount,
        order.items,
        order.trackingNumbers,
        order.trackingUrls,
        order.note,
        order.tags,
        order.createdAt,
        order.updatedAt
      ];

      // Find last row with data, then write at next row
      const data = await this.readSheet(spreadsheetId, `${sheetName}!A:A`);
      const nextRow = (data?.length || 0) + 1;
      await this.writeSheet(spreadsheetId, `${sheetName}!A${nextRow}:AJ${nextRow}`, [row]);

      return {success: true};
    } catch (error) {
      console.error('Error appending order:', error);
      throw new Error(`Failed to append order: ${error.message}`);
    }
  }

  /**
   * Update existing order in sheet by order number
   */
  async updateOrder(spreadsheetId, sheetName, orderNumber, order) {
    try {
      // Read all data to find the row
      const data = await this.readSheet(spreadsheetId, `${sheetName}!A:A`);

      // Find row index (column A contains order numbers)
      let rowIndex = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === orderNumber) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error(`Order ${orderNumber} not found in sheet`);
      }

      // Update the row
      const row = [
        order.orderNumber,
        order.orderId,
        order.orderDate,
        order.orderStatus,
        order.fulfillmentStatus,
        order.totalPrice,
        order.currency,
        order.paymentMethod,
        order.customerId,
        order.customerEmail,
        order.customerPhone,
        order.customerFirstName,
        order.customerLastName,
        order.customerFullName,
        order.shippingName,
        order.shippingAddress1,
        order.shippingAddress2,
        order.shippingCity,
        order.shippingProvince,
        order.shippingZip,
        order.shippingCountry,
        order.shippingPhone,
        order.billingName,
        order.billingAddress1,
        order.billingCity,
        order.billingProvince,
        order.billingZip,
        order.billingCountry,
        order.itemsCount,
        order.items,
        order.trackingNumbers,
        order.trackingUrls,
        order.note,
        order.tags,
        order.createdAt,
        order.updatedAt
      ];

      await this.writeSheet(spreadsheetId, `${sheetName}!A${rowIndex}:AJ${rowIndex}`, [row]);

      return {success: true};
    } catch (error) {
      throw new Error(`Failed to update order: ${error.message}`);
    }
  }
}
