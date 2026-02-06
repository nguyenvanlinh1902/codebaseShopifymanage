import {SheetRepository} from '../repositories/sheetRepository.js';
import {GoogleSheetsService} from '../services/googleSheetsService.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';

const sheetRepo = new SheetRepository();
const authRepo = new GoogleAuthRepository();

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
    const {userId, page, limit} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 5));

    const {sheets, total} = await sheetRepo.getByUserIdPaginated(userId, {
      page: pageNum,
      limit: limitNum
    });

    // Remove sensitive/legacy fields
    const sanitizedSheets = sheets.map(
      ({credentials, refreshToken, accessToken, tokenExpiresAt, ...sheetData}) => sheetData
    );

    return res.json({
      success: true,
      data: sanitizedSheets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
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
    const {...sheetData} = sheet;

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

    // Initialize Google Sheets service (3-tier fallback)
    const sheetsService = sheet.credentials
      ? new GoogleSheetsService(sheet.credentials)
      : sheet.refreshToken
      ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
      : await GoogleSheetsService.createForUser(sheet.userId);

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

/**
 * Get live tabs from a connected spreadsheet
 */
export async function getSheetTabs(req, res) {
  try {
    const {sheetId} = req.params;

    const sheet = await sheetRepo.getById(sheetId);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }

    // Initialize Google Sheets service (3-tier fallback)
    const sheetsService = sheet.credentials
      ? new GoogleSheetsService(sheet.credentials)
      : sheet.refreshToken
      ? await GoogleSheetsService.createFromRefreshToken(sheet.refreshToken)
      : await GoogleSheetsService.createForUser(sheet.userId);

    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo(sheet.spreadsheetId);

    return res.json({
      success: true,
      data: spreadsheetInfo.sheets
    });
  } catch (error) {
    console.error('Get sheet tabs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Add sheet from Google Picker selection (new flow)
 */
export async function addSheetFromPicker(req, res) {
  try {
    const {userId, spreadsheetId, name, refreshToken, googleEmail} = req.body;

    if (!userId || !spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'userId and spreadsheetId are required'
      });
    }

    // Check if already connected
    const existing = await sheetRepo.getBySpreadsheetId(spreadsheetId);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'This sheet is already connected'
      });
    }

    // Determine which token to use and save
    let tokenToSave = refreshToken;
    let emailToSave = googleEmail;

    // Fallback 1: centralized auth (primary account)
    if (!tokenToSave) {
      const authRecord = await authRepo.getByUserId(userId);
      if (authRecord && (!emailToSave || authRecord.googleEmail === emailToSave)) {
        tokenToSave = authRecord.refreshToken;
        emailToSave = emailToSave || authRecord.googleEmail;
      }
    }

    // Fallback 2: copy refreshToken from sibling sheet with same googleEmail
    if (!tokenToSave && emailToSave) {
      const userSheets = await sheetRepo.getByUserId(userId);
      const donor = userSheets.find(s => s.googleEmail === emailToSave && s.refreshToken);
      if (donor) tokenToSave = donor.refreshToken;
    }

    // Create service to verify access
    const sheetsService = tokenToSave
      ? await GoogleSheetsService.createFromRefreshToken(tokenToSave)
      : await GoogleSheetsService.createForUser(userId);

    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);

    const sheet = await sheetRepo.create({
      userId,
      spreadsheetId,
      name: name || spreadsheetInfo.title,
      title: spreadsheetInfo.title,
      sheets: spreadsheetInfo.sheets,
      refreshToken: tokenToSave,
      googleEmail: emailToSave || '',
      status: 'active'
    });

    return res.json({
      success: true,
      message: 'Sheet connected successfully',
      data: sheet
    });
  } catch (error) {
    console.error('Add sheet from picker error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
