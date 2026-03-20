import {google} from 'googleapis';
import {GMAIL_OAUTH_CONFIG, GMAIL_SCOPES} from '../../config/gmail-oauth.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {GmailService} from '../../services/gmail-service.js';
import {GmailWatchRepository} from '../../repositories/gmail-watch-repository.js';

function createGmailOAuth2Client() {
  return new google.auth.OAuth2(
    GMAIL_OAUTH_CONFIG.clientId,
    GMAIL_OAUTH_CONFIG.clientSecret,
    GMAIL_OAUTH_CONFIG.redirectUri
  );
}

/**
 * GET /api/gmail/auth-url — generate Gmail-specific OAuth URL
 */
export async function getGmailAuthUrl(req, res) {
  try {
    const oauth2Client = createGmailOAuth2Client();
    const state = JSON.stringify({
      userId: req.userId || '',
      storeId: req.query.storeId || 'default',
      mode: 'gmail'
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      prompt: 'select_account consent',
      state
    });

    return res.json({success: true, data: {authUrl}});
  } catch (error) {
    console.error('[Gmail:Auth] URL error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/gmail/auth/exchange — exchange code for Gmail tokens
 */
export async function exchangeGmailCode(req, res) {
  try {
    const {code, state} = req.body;
    if (!code) {
      return res.status(400).json({success: false, error: 'code is required'});
    }

    const parsedState = state ? JSON.parse(state) : {};
    const storeId = parsedState.storeId || req.storeId || 'default';
    const userId = parsedState.userId || req.userId || 'default-user';

    const oauth2Client = createGmailOAuth2Client();
    const {tokens} = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email;

    // Store in google_auth collection with gmail scope marker
    const authRepo = new GoogleAuthRepository();
    await authRepo.upsertByStoreAndEmail(storeId, userId, googleEmail, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      scope: tokens.scope,
      authType: 'gmail'
    });

    // Auto-start Gmail Watch after connecting
    try {
      const PUBSUB_TOPIC = 'projects/' + (process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT) + '/topics/gmail-notifications';
      const gmailService = new GmailService(oauth2Client);
      const watchResult = await gmailService.watchMailbox(PUBSUB_TOPIC);

      const watchRepo = new GmailWatchRepository();
      await watchRepo.upsertWatch(googleEmail, storeId, userId, {
        historyId: watchResult.historyId,
        watchExpiration: watchResult.expiration,
        topicName: PUBSUB_TOPIC,
        status: 'active',
        lastSyncTime: new Date().toISOString(),
        renewalError: null
      });
      console.log(`[Gmail:Auth] Auto-started watch for ${googleEmail}`);
    } catch (watchErr) {
      // Watch failure is non-blocking — user can start manually later
      console.warn(`[Gmail:Auth] Auto-watch failed for ${googleEmail}: ${watchErr.message}`);
    }

    return res.json({
      success: true,
      data: {googleEmail, authType: 'gmail'}
    });
  } catch (error) {
    console.error('[Gmail:Auth] Exchange error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/gmail/accounts — list Gmail-connected accounts
 */
export async function getGmailAccounts(req, res) {
  try {
    const authRepo = new GoogleAuthRepository();
    const allAccounts = await authRepo.getAllByStoreAndUser(req.query.storeId || 'default', req.userId);
    // Filter to only gmail-type accounts (or accounts with gmail scope)
    const gmailAccounts = allAccounts.filter(a =>
      a.authType === 'gmail' || a.scope?.includes('gmail.readonly')
    );

    return res.json({
      success: true,
      data: gmailAccounts.map(a => ({
        email: a.googleEmail,
        authType: a.authType || 'shared',
        connectedAt: a.createdAt
      }))
    });
  } catch (error) {
    console.error('[Gmail:Auth] Accounts error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/gmail/disconnect — disconnect a Gmail account
 */
export async function disconnectGmailAccount(req, res) {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400).json({success: false, error: 'email is required'});
    }

    const authRepo = new GoogleAuthRepository();
    await authRepo.deleteByStoreAndEmail(req.body.storeId || 'default', req.userId, email);

    return res.json({success: true, data: {message: `Disconnected ${email}`}});
  } catch (error) {
    console.error('[Gmail:Auth] Disconnect error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
