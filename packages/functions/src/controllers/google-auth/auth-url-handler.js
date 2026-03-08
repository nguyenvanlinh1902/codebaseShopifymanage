import {GOOGLE_SHEETS_CONFIG} from '../../config/googleSheets.js';
import {createOAuth2Client} from './oauth-client-factory.js';

/**
 * GET /api/google/auth-url
 * Generate Google OAuth authorization URL
 */
export async function getGoogleAuthUrl(req, res) {
  try {
    const {mode, storeId} = req.query;
    // Use userId from JWT middleware (req.userId) — req.query.userId is not sent by frontend
    const userId = req.userId || req.query.userId || '';
    const oauth2Client = createOAuth2Client();

    const state = JSON.stringify({
      userId,
      mode: mode || 'connect',
      storeId: storeId || ''
    });

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
