import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {SheetRepository} from '../../repositories/sheetRepository.js';
import {GOOGLE_OAUTH_CONFIG} from '../../config/googleSheets.js';
import {createOAuth2Client} from './oauth-client-factory.js';

const authRepo = new GoogleAuthRepository();
const sheetRepo = new SheetRepository();

/**
 * GET /api/google/picker-token
 * Get fresh access token + config for Google Picker
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function getPickerToken(req, res) {
  try {
    const {userId, storeId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    // SECURITY FIX: Use store-scoped method
    const authRecord = await authRepo.getByStoreAndUser(storeId, userId);

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
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function getAccountToken(req, res) {
  try {
    const {userId, googleEmail, storeId} = req.query;

    if (!userId || !googleEmail) {
      return res.status(400).json({success: false, error: 'userId and googleEmail are required'});
    }

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    const appId = GOOGLE_OAUTH_CONFIG.clientId?.split('-')[0] || '';

    // Find refresh_token: auth records first, then sheet records
    // SECURITY FIX: Use store-scoped methods
    let refreshToken = null;

    const authRecord = await authRepo.getByStoreUserAndEmail(storeId, userId, googleEmail);
    if (authRecord) {
      refreshToken = authRecord.refreshToken;
    }

    if (!refreshToken) {
      const userSheets = await sheetRepo.getByStoreAndUser(storeId, userId);
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
