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
   * Factory: create a service instance from any available auth record
   */
  static async createFromAnyAuth(authRepo) {
    const allRecords = await authRepo.getAll();
    const record = allRecords.find(r => r.refreshToken);
    if (!record) {
      throw new Error('No Google auth found. Please connect a Google account.');
    }
    return GoogleSheetsService.createFromRefreshToken(record.refreshToken);
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
    const rows = [GoogleSheetsService.ORDER_HEADERS];
    let stt = 1;

    for (const order of orders) {
      const addr = order.shipping_address || {};
      const lineItems = order.line_items || [];
      const createdAt = order.created_at ? order.created_at.split('T')[0] : '';

      const buildRow = (item, index) => {
        const props = (item.properties || []).filter(p => p.name && !p.name.startsWith('_'));
        const sizeProp = props.find(p => /size/i.test(p.name));
        const typeProp = props.find(p => /type/i.test(p.name));
        const nameProp = props.find(p => /name/i.test(p.name));
        const designProp = props.find(p => /design/i.test(p.name));
        const isFirst = index === 0;

        return [
          isFirst ? stt : '',
          order.name || '',
          order.email || '',
          createdAt,
          '', // Base cost (item-level, manual)
          sizeProp ? sizeProp.value : '',
          typeProp ? typeProp.value : '',
          item.quantity || '',
          item.name || '',
          item.sku || '',
          '', // Product Link (not available in bulk export)
          '', // Variant Image (not available in bulk export)
          item.price || '',
          addr.country_code || '',
          isFirst ? order.payment_gateway_names?.[0] || '' : '',
          isFirst ? order.total_price || '' : '',
          isFirst ? order.total_tax || '' : '',
          '', // Fee (PP/ST & Shopify) - manual
          isFirst ? order.note || '' : '',
          isFirst ? addr.address1 || '' : '',
          addr.name || '',
          addr.address1 || '',
          addr.address2 || '',
          addr.city || '',
          addr.zip || '',
          addr.province || '',
          addr.country_code || '',
          addr.phone || '',
          nameProp ? `${nameProp.name}: ${nameProp.value}` : '',
          designProp ? `${designProp.name}: ${designProp.value}` : ''
        ];
      };

      if (lineItems.length === 0) {
        rows.push(buildRow({name: '', sku: '', price: '', quantity: '', properties: []}, 0));
      } else {
        lineItems.forEach((item, index) => rows.push(buildRow(item, index)));
      }
      stt++;
    }

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
   * Get order sheet headers
   */
  static get ORDER_HEADERS() {
    return [
      'STT',
      'Order Number',
      'Email',
      'Created at',
      'Base cost',
      'Size',
      'Type',
      'Quantity',
      'Product name',
      'Product SKU',
      'Product Link',
      'Variant Image',
      'Lineitem price',
      'Shipping Country',
      'Payment Method',
      'Total',
      'Tax',
      'Fee (PP/ST & Shopify)',
      'Note',
      'Shipping Address',
      'Shipping Name',
      'Shipping Address 1',
      'Shipping Address 2',
      'Shipping City',
      'Shipping Zip',
      'Shipping State',
      'Shipping Country Code',
      'Shipping Phone',
      'Custom name',
      'Design'
    ];
  }

  /**
   * Ensure headers exist in sheet. If not, write them.
   */
  async ensureHeaders(spreadsheetId, sheetName) {
    try {
      const data = await this.readSheet(spreadsheetId, `${sheetName}!A1:AD1`);
      if (!data || data.length === 0 || data[0][0] !== 'STT') {
        await this.writeSheet(spreadsheetId, `${sheetName}!A1`, [
          GoogleSheetsService.ORDER_HEADERS
        ]);
        return true;
      }
      return false;
    } catch {
      await this.writeSheet(spreadsheetId, `${sheetName}!A1`, [GoogleSheetsService.ORDER_HEADERS]);
      return true;
    }
  }

  /**
   * Get next STT number by reading max STT from column A
   */
  async getNextSTT(spreadsheetId, sheetName) {
    try {
      const data = await this.readSheet(spreadsheetId, `${sheetName}!A:A`);
      if (!data || data.length <= 1) return 1;
      let maxSTT = 0;
      for (let i = 1; i < data.length; i++) {
        const val = parseInt(data[i][0]);
        if (!isNaN(val) && val > maxSTT) maxSTT = val;
      }
      return maxSTT + 1;
    } catch {
      return 1;
    }
  }

  /**
   * Assign STT numbers to order rows.
   * Only the first row of each order gets a STT number.
   */
  static assignSTT(orders, startSTT) {
    let stt = startSTT;
    for (const order of orders) {
      order.rows[0][0] = stt;
      stt++;
    }
  }

  /**
   * Write orders to Google Sheets with headers (per-line-item rows)
   * Each order is { orderId, orderNumber, rows: [[...], [...]] }
   */
  async writeOrders(spreadsheetId, sheetName, orders) {
    try {
      // Assign STT starting from 1
      GoogleSheetsService.assignSTT(orders, 1);

      const rows = orders.flatMap(order => order.rows);
      const allRows = [GoogleSheetsService.ORDER_HEADERS, ...rows];
      await this.writeSheet(spreadsheetId, `${sheetName}!A1`, allRows);

      return {success: true, rowsWritten: rows.length};
    } catch (error) {
      console.error('Error writing orders:', error);
      throw new Error(`Failed to write orders: ${error.message}`);
    }
  }

  /**
   * Append single order to sheet (multiple rows, one per line item)
   * order is { orderId, orderNumber, rows: [[...], [...]] }
   */
  async appendOrder(spreadsheetId, sheetName, order) {
    try {
      // Ensure headers exist
      await this.ensureHeaders(spreadsheetId, sheetName);

      // Assign STT
      const nextSTT = await this.getNextSTT(spreadsheetId, sheetName);
      order.rows[0][0] = nextSTT;

      // Read column B (Order Number) to find last row - column A (STT) has empty
      // cells for sub-line-items which causes Google Sheets API to trim them
      const data = await this.readSheet(spreadsheetId, `${sheetName}!B:B`);
      const nextRow = (data?.length || 0) + 1;
      const endRow = nextRow + order.rows.length - 1;
      await this.writeSheet(spreadsheetId, `${sheetName}!A${nextRow}:AD${endRow}`, order.rows);

      return {success: true};
    } catch (error) {
      console.error('Error appending order:', error);
      throw new Error(`Failed to append order: ${error.message}`);
    }
  }

  /**
   * Append multiple orders to sheet (batch append, no headers)
   * Each order is { orderId, orderNumber, rows: [[...], [...]] }
   */
  async appendOrders(spreadsheetId, sheetName, orders) {
    try {
      // Ensure headers exist
      await this.ensureHeaders(spreadsheetId, sheetName);

      // Assign STT for each order
      const nextSTT = await this.getNextSTT(spreadsheetId, sheetName);
      GoogleSheetsService.assignSTT(orders, nextSTT);

      const rows = orders.flatMap(order => order.rows);
      await this.appendSheet(spreadsheetId, `${sheetName}!A1`, rows);
      return {success: true, rowsAppended: rows.length};
    } catch (error) {
      console.error('Error appending orders:', error);
      throw new Error(`Failed to append orders: ${error.message}`);
    }
  }

  /**
   * Update existing order in sheet by order number
   * Searches column B (Order Number) and replaces all matching rows
   * order is { orderId, orderNumber, rows: [[...], [...]] }
   */
  async updateOrder(spreadsheetId, sheetName, orderNumber, order) {
    try {
      // Read column B to find rows matching this order number
      const data = await this.readSheet(spreadsheetId, `${sheetName}!B:B`);

      // Find all row indices for this order (column B contains order numbers)
      const matchingRows = [];
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === orderNumber) {
          matchingRows.push(i + 1); // +1 because sheets are 1-indexed
        }
      }

      if (matchingRows.length === 0) {
        throw new Error(`Order ${orderNumber} not found in sheet`);
      }

      // Write new rows starting at the first matching row
      const startRow = matchingRows[0];
      const newRows = order.rows;
      const endRow = startRow + newRows.length - 1;
      await this.writeSheet(spreadsheetId, `${sheetName}!A${startRow}:AD${endRow}`, newRows);

      return {success: true};
    } catch (error) {
      throw new Error(`Failed to update order: ${error.message}`);
    }
  }
}
