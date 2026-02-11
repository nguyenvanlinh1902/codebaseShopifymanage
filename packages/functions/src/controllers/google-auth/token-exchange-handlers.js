import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {GOOGLE_SHEETS_CONFIG} from '../../config/googleSheets.js';
import {createOAuth2Client, getGoogleUserEmail} from './oauth-client-factory.js';

const authRepo = new GoogleAuthRepository();

/**
 * POST /api/google/exchange
 * Exchange authorization code for tokens and save (multi-account)
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function exchangeGoogleCode(req, res) {
  try {
    const {code, userId, storeId} = req.body;

    if (!code || !userId) {
      return res.status(400).json({success: false, error: 'code and userId are required'});
    }

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    const oauth2Client = createOAuth2Client();
    const {tokens} = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Try to get user's Google email
    const googleEmail = await getGoogleUserEmail(oauth2Client);

    // SECURITY FIX: Use store-scoped method
    await authRepo.upsertByStoreAndEmail(storeId, userId, googleEmail, {
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
    const googleEmail = await getGoogleUserEmail(oauth2Client);

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
