import {google} from 'googleapis';
import {GOOGLE_OAUTH_CONFIG} from '../../config/googleSheets.js';

/**
 * Factory for creating OAuth2 clients with app-level credentials
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );
}

/**
 * Get Google user info from OAuth2 client
 */
export async function getGoogleUserEmail(oauth2Client) {
  try {
    const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
    const userInfo = await oauth2.userinfo.get();
    return userInfo.data.email || '';
  } catch (e) {
    return '';
  }
}
