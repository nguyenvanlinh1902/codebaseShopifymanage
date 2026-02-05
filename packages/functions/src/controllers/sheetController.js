import {SheetRepository} from '../repositories/sheetRepository.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';

const sheetRepo = new SheetRepository();

/**
 * Sheet Controller
 * Handles Google Sheets connection and management
 */

/**
 * Get OAuth authorization URL
 */
export async function getAuthUrl(req, res) {
  try {
    const {clientId, clientSecret, redirectUri} = req.body;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'clientId, clientSecret, and redirectUri are required'
      });
    }

    const sheetsService = new GoogleSheetsService({
      clientId,
      clientSecret,
      redirectUri
    });

    const authUrl = sheetsService.getAuthUrl();

    return res.json({
      success: true,
      data: {authUrl}
    });
  } catch (error) {
    console.error('Get auth URL error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Exchange authorization code for tokens and save sheet connection
 */
export async function connectSheet(req, res) {
  try {
    const {userId, code, clientId, clientSecret, redirectUri, spreadsheetId, name} = req.body;

    if (!userId || !code || !clientId || !clientSecret || !redirectUri || !spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Exchange code for tokens
    const sheetsService = new GoogleSheetsService({
      clientId,
      clientSecret,
      redirectUri
    });

    const tokens = await sheetsService.getTokens(code);

    // Initialize with tokens
    sheetsService.initializeAuth({
      clientId,
      clientSecret,
      redirectUri,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    });

    // Get spreadsheet info
    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);

    // Check if sheet already exists
    const existingSheet = await sheetRepo.getBySpreadsheetId(spreadsheetId);
    if (existingSheet) {
      return res.status(400).json({
        success: false,
        error: 'Sheet already connected'
      });
    }

    // Save to database
    const sheet = await sheetRepo.create({
      userId,
      spreadsheetId,
      name: name || spreadsheetInfo.title,
      title: spreadsheetInfo.title,
      sheets: spreadsheetInfo.sheets,
      credentials: {
        clientId,
        clientSecret,
        redirectUri,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      },
      status: 'active'
    });

    // Don't send credentials in response
    const {credentials, ...sheetData} = sheet;

    return res.json({
      success: true,
      message: 'Sheet connected successfully',
      data: sheetData
    });
  } catch (error) {
    console.error('Connect sheet error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all sheets for a user
 */
export async function getSheets(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const sheets = await sheetRepo.getByUserId(userId);

    // Remove credentials
    const sanitizedSheets = sheets.map(sheet => {
      const {credentials, ...sheetData} = sheet;
      return sheetData;
    });

    return res.json({
      success: true,
      data: sanitizedSheets
    });
  } catch (error) {
    console.error('Get sheets error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get sheet by ID
 */
export async function getSheet(req, res) {
  try {
    const {sheetId} = req.params;

    const sheet = await sheetRepo.getById(sheetId);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }

    // Remove credentials
    const {credentials, ...sheetData} = sheet;

    return res.json({
      success: true,
      data: sheetData
    });
  } catch (error) {
    console.error('Get sheet error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete sheet connection
 */
export async function deleteSheet(req, res) {
  try {
    const {sheetId} = req.params;

    const sheet = await sheetRepo.getById(sheetId);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }

    await sheetRepo.delete(sheetId);

    return res.json({
      success: true,
      message: 'Sheet connection deleted successfully'
    });
  } catch (error) {
    console.error('Delete sheet error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Preview sheet data
 */
export async function previewSheetData(req, res) {
  try {
    const {sheetId, range} = req.query;

    if (!sheetId || !range) {
      return res.status(400).json({
        success: false,
        error: 'sheetId and range are required'
      });
    }

    const sheet = await sheetRepo.getById(sheetId);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }

    // Initialize Google Sheets service
    const sheetsService = new GoogleSheetsService(sheet.credentials);

    // Read data
    const rows = await sheetsService.readSheet(sheet.spreadsheetId, range);

    return res.json({
      success: true,
      data: {
        rows,
        count: rows.length
      }
    });
  } catch (error) {
    console.error('Preview sheet data error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
