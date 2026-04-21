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
      const projectId =
        process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        process.env.GCP_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT;
      const PUBSUB_TOPIC = `projects/${projectId}/topics/gmail-notifications`;
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
 * GET /api/gmail/accounts — list Gmail-connected accounts.
 * Scope rules:
 *  - Admin: all accounts. Optional ?groupId= filters by store.groupId.
 *  - Staff/Manager: only accounts whose storeId (or any linkedStoreIds) is in
 *    the caller's assignedStores.
 */
export async function getGmailAccounts(req, res) {
  try {
    const authRepo = new GoogleAuthRepository();
    const {filterAccountsByAccess, enrichAccountsWithStoreLabels} =
      await import('../../helpers/email-access-guard.js');

    const all = await authRepo.getAll();
    const gmailOnly = all.filter(a =>
      a.authType === 'gmail' || a.scope?.includes('gmail.readonly')
    );

    const scoped = await filterAccountsByAccess(req, gmailOnly);
    const enriched = await enrichAccountsWithStoreLabels(scoped);

    const groupFilter = req.query.groupId;
    const final = groupFilter
      ? enriched.filter(a => a.groupId === groupFilter)
      : enriched;

    return res.json({
      success: true,
      data: final.map(a => ({
        email: a.googleEmail,
        authType: a.authType || 'shared',
        storeId: a.storeId,
        storeName: a.storeName,
        groupId: a.groupId,
        userId: req.userRole === 'admin' ? a.userId : undefined,
        connectedAt: a.createdAt,
        lastRefreshed: a.updatedAt,
        authStatus: a.authStatus || 'active',
        linkedStoreIds: a.linkedStoreIds || []
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

    const isAdmin = req.userRole === 'admin';
    const storeId = req.body.storeId || 'default';
    const authRepo = new GoogleAuthRepository();

    if (isAdmin) {
      // Admin: find the account by store+email, then delete it
      const record = await authRepo.getByStoreAndEmail(storeId, email);
      if (record) {
        await authRepo.deleteByStoreAndEmail(storeId, record.userId, email);
      }
    } else {
      await authRepo.deleteByStoreAndEmail(storeId, req.userId, email);
    }

    return res.json({success: true, data: {message: `Disconnected ${email}`}});
  } catch (error) {
    console.error('[Gmail:Auth] Disconnect error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * PUT /api/gmail/linked-stores (or /api/outlook/linked-stores)
 * Update linked store IDs for an email account.
 * Body: { email: string, linkedStoreIds: string[] }
 */
export async function updateLinkedStores(req, res) {
  try {
    const {email, linkedStoreIds} = req.body;
    if (!email) return res.status(400).json({success: false, error: 'email is required'});
    if (!Array.isArray(linkedStoreIds)) return res.status(400).json({success: false, error: 'linkedStoreIds must be an array'});

    const storeId = req.body.storeId || 'default';
    const authRepo = new GoogleAuthRepository();
    const result = await authRepo.updateLinkedStores(storeId, email, linkedStoreIds);
    return res.json({success: true, data: result});
  } catch (error) {
    console.error('[Auth] Update linked stores error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
