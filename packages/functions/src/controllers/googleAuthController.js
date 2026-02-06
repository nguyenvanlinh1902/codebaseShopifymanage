import {google} from 'googleapis';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {SheetRepository} from '../repositories/sheetRepository.js';
import {GOOGLE_OAUTH_CONFIG, GOOGLE_SHEETS_CONFIG} from '../config/googleSheets.js';

const authRepo = new GoogleAuthRepository();
const sheetRepo = new SheetRepository();

/**
 * Create an OAuth2 client with app-level credentials
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );
}

/**
 * GET /api/google/auth-url
 * Generate Google OAuth authorization URL
 */
export async function getGoogleAuthUrl(req, res) {
  try {
    const {userId, mode} = req.query;
    const oauth2Client = createOAuth2Client();

    const state = JSON.stringify({userId: userId || '', mode: mode || 'connect'});

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SHEETS_CONFIG.scopes,
      prompt: 'select_account consent',
      state
    });

    return res.json({success: true, data: {authUrl}});
  } catch (error) {
    console.error('Get Google auth URL error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/exchange
 * Exchange authorization code for tokens and save (multi-account)
 */
export async function exchangeGoogleCode(req, res) {
  try {
    const {code, userId} = req.body;

    if (!code || !userId) {
      return res.status(400).json({success: false, error: 'code and userId are required'});
    }

    const oauth2Client = createOAuth2Client();
    const {tokens} = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Try to get user's Google email
    let googleEmail = '';
    try {
      const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
      const userInfo = await oauth2.userinfo.get();
      googleEmail = userInfo.data.email || '';
    } catch (e) {
      // email is optional
    }

    await authRepo.upsertByEmail(userId, googleEmail, {
      refreshToken: tokens.refresh_token,
      scopes: GOOGLE_SHEETS_CONFIG.scopes
    });

    return res.json({success: true, message: 'Google account connected', data: {googleEmail}});
  } catch (error) {
    console.error('Exchange Google code error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/exchange-temp
 * Exchange authorization code for tokens WITHOUT saving to DB
 */
export async function exchangeGoogleCodeTemp(req, res) {
  try {
    const {code} = req.body;

    if (!code) {
      return res.status(400).json({success: false, error: 'code is required'});
    }

    const oauth2Client = createOAuth2Client();
    const {tokens} = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get Google email
    let googleEmail = '';
    try {
      const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
      const userInfo = await oauth2.userinfo.get();
      googleEmail = userInfo.data.email || '';
    } catch (e) {
      // email is optional
    }

    return res.json({
      success: true,
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        googleEmail
      }
    });
  } catch (error) {
    console.error('Exchange Google code temp error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/google/status
 * Check if user has any valid Google auth
 */
export async function checkGoogleAuth(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    const allRecords = await authRepo.getAllByUserId(userId);
    const validRecord = allRecords.find(r => r.refreshToken);

    if (!validRecord) {
      return res.json({success: true, data: {authenticated: false}});
    }

    return res.json({
      success: true,
      data: {
        authenticated: true,
        googleEmail: validRecord.googleEmail
      }
    });
  } catch (error) {
    console.error('Check Google auth error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/disconnect
 * Remove Google auth for a user
 */
export async function disconnectGoogle(req, res) {
  try {
    const {userId} = req.body;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    await authRepo.delete(userId);
    return res.json({success: true, message: 'Google account disconnected'});
  } catch (error) {
    console.error('Disconnect Google error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/google/picker-token
 * Get fresh access token + config for Google Picker
 */
export async function getPickerToken(req, res) {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    const authRecord = await authRepo.getByUserId(userId);

    if (!authRecord || !authRecord.refreshToken) {
      return res.status(401).json({success: false, error: 'Not authenticated with Google'});
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({refresh_token: authRecord.refreshToken});
    const {credentials} = await oauth2Client.refreshAccessToken();

    const appId = GOOGLE_OAUTH_CONFIG.clientId?.split('-')[0] || '';

    return res.json({
      success: true,
      data: {
        accessToken: credentials.access_token,
        apiKey: GOOGLE_OAUTH_CONFIG.apiKey,
        appId,
        clientId: GOOGLE_OAUTH_CONFIG.clientId
      }
    });
  } catch (error) {
    console.error('Get picker token error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/google/account-token
 * Get fresh access token for a specific Google account
 */
export async function getAccountToken(req, res) {
  try {
    const {userId, googleEmail} = req.query;

    if (!userId || !googleEmail) {
      return res.status(400).json({success: false, error: 'userId and googleEmail are required'});
    }

    const appId = GOOGLE_OAUTH_CONFIG.clientId?.split('-')[0] || '';

    // Find refresh_token: auth records first, then sheet records
    let refreshToken = null;

    const authRecord = await authRepo.getByUserIdAndEmail(userId, googleEmail);
    if (authRecord) {
      refreshToken = authRecord.refreshToken;
    }

    if (!refreshToken) {
      const userSheets = await sheetRepo.getByUserId(userId);
      const donor = userSheets.find(s => s.googleEmail === googleEmail && s.refreshToken);
      if (donor) refreshToken = donor.refreshToken;
    }

    if (!refreshToken) {
      return res.status(404).json({
        success: false,
        error: 'No refresh token found for this Google account'
      });
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({refresh_token: refreshToken});
    const {credentials} = await oauth2Client.refreshAccessToken();

    return res.json({
      success: true,
      data: {
        accessToken: credentials.access_token,
        appId,
        clientId: GOOGLE_OAUTH_CONFIG.clientId
      }
    });
  } catch (error) {
    console.error('Get account token error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/disconnect-account
 * Disconnect a specific Google account: remove auth record + delete all its sheets
 */
export async function disconnectAccount(req, res) {
  try {
    const {userId, googleEmail} = req.body;

    if (!userId || !googleEmail) {
      return res.status(400).json({success: false, error: 'userId and googleEmail are required'});
    }

    // Remove auth record for this email
    await authRepo.deleteByEmail(userId, googleEmail);

    // Remove all sheets belonging to this Google account
    const userSheets = await sheetRepo.getByUserId(userId);
    const sheetsToDelete = userSheets.filter(s => s.googleEmail === googleEmail);
    for (const sheet of sheetsToDelete) {
      await sheetRepo.delete(sheet.id);
    }

    return res.json({
      success: true,
      message: `Disconnected ${googleEmail}`,
      data: {deletedSheets: sheetsToDelete.length}
    });
  } catch (error) {
    console.error('Disconnect account error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/bulk-disconnect-accounts
 * Disconnect multiple Google accounts at once
 */
export async function bulkDisconnectAccounts(req, res) {
  try {
    const {userId, emails} = req.body;

    if (!userId || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({success: false, error: 'userId and emails array are required'});
    }

    let totalDeletedSheets = 0;

    const results = await Promise.allSettled(
      emails.map(async googleEmail => {
        // Remove auth record for this email
        await authRepo.deleteByEmail(userId, googleEmail);

        // Remove all sheets belonging to this Google account
        const userSheets = await sheetRepo.getByUserId(userId);
        const sheetsToDelete = userSheets.filter(s => s.googleEmail === googleEmail);
        for (const sheet of sheetsToDelete) {
          await sheetRepo.delete(sheet.id);
        }

        totalDeletedSheets += sheetsToDelete.length;
        return {email: googleEmail, success: true, deletedSheets: sheetsToDelete.length};
      })
    );

    const disconnected = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - disconnected;

    return res.json({
      success: true,
      message: `Disconnected ${disconnected} account(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      disconnected,
      failed,
      totalDeletedSheets
    });
  } catch (error) {
    console.error('Bulk disconnect accounts error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/google/connected-accounts
 * Get paginated list of connected Google accounts with sheet counts
 */
export async function getConnectedAccounts(req, res) {
  try {
    const {userId, page, limit, search} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 5));

    // Build accounts map from ALL auth records + sheets
    const accountMap = new Map();

    const allAuthRecords = await authRepo.getAllByUserId(userId);
    allAuthRecords.forEach(record => {
      if (record.googleEmail) {
        accountMap.set(record.googleEmail, {email: record.googleEmail, sheetCount: 0});
      }
    });

    const userSheets = await sheetRepo.getByUserId(userId);
    userSheets.forEach(sheet => {
      if (!sheet.googleEmail) return;
      if (accountMap.has(sheet.googleEmail)) {
        accountMap.get(sheet.googleEmail).sheetCount++;
      } else {
        accountMap.set(sheet.googleEmail, {email: sheet.googleEmail, sheetCount: 1});
      }
    });

    let filteredAccounts = Array.from(accountMap.values());

    if (search) {
      const searchLower = search.toLowerCase();
      filteredAccounts = filteredAccounts.filter(a => a.email.toLowerCase().includes(searchLower));
    }

    const total = filteredAccounts.length;
    const offset = (pageNum - 1) * limitNum;
    const accounts = filteredAccounts.slice(offset, offset + limitNum);

    return res.json({
      success: true,
      data: accounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get connected accounts error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
