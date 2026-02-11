import {GOOGLE_SHEETS_CONFIG} from '../../config/googleSheets.js';
import {createOAuth2Client} from './oauth-client-factory.js';

/**
 * GET /api/google/auth-url
 * Generate Google OAuth authorization URL
 */
export async function getGoogleAuthUrl(req, res) {
  try {
    const {userId, mode, storeId} = req.query;
    const oauth2Client = createOAuth2Client();

    const state = JSON.stringify({
      userId: userId || '',
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
