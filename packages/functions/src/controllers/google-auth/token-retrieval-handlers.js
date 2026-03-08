import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {SheetRepository} from '../../repositories/sheetRepository.js';
import {GOOGLE_OAUTH_CONFIG} from '../../config/googleSheets.js';
import {createOAuth2Client} from './oauth-client-factory.js';

const authRepo = new GoogleAuthRepository();
const sheetRepo = new SheetRepository();

/**
 * GET /api/google/picker-token
 * Get fresh access token + config for Google Picker
 */
export async function getPickerToken(req, res) {
  try {
    // Find any valid auth record with a refresh token
    const allRecords = await authRepo.getAll();
    const authRecord = allRecords.find(r => r.refreshToken);

    if (!authRecord) {
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
    const {googleEmail} = req.query;

    if (!googleEmail) {
      return res.status(400).json({success: false, error: 'googleEmail is required'});
    }

    const appId = GOOGLE_OAUTH_CONFIG.clientId?.split('-')[0] || '';

    // Find refresh_token from auth records or sheets by googleEmail
    let refreshToken = null;

    const allAuthRecords = await authRepo.getAll();
    const authRecord = allAuthRecords.find(r => r.googleEmail === googleEmail && r.refreshToken);
    if (authRecord) {
      refreshToken = authRecord.refreshToken;
    }

    if (!refreshToken) {
      const allSheets = await sheetRepo.getAll();
      const donor = allSheets.find(s => s.googleEmail === googleEmail && s.refreshToken);
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
