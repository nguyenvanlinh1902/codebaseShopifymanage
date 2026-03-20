import crypto from 'crypto';
import {OUTLOOK_OAUTH_CONFIG, OUTLOOK_SCOPES} from '../../config/outlook-oauth.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {OutlookService} from '../../services/outlook-service.js';
import {OutlookWatchRepository} from '../../repositories/outlook-watch-repository.js';

// In-memory store for PKCE code verifiers (short-lived, cleared after use)
const pkceStore = new Map();

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * GET /api/outlook/auth-url — generate Outlook OAuth URL with PKCE
 */
export async function getOutlookAuthUrl(req, res) {
  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const stateObj = {
      userId: req.userId || '',
      storeId: req.query.storeId || 'default',
      mode: 'outlook'
    };
    const state = JSON.stringify(stateObj);

    // Store code_verifier keyed by state for retrieval during token exchange
    pkceStore.set(state, codeVerifier);
    // Auto-cleanup after 10 minutes
    setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

    const params = new URLSearchParams({
      client_id: OUTLOOK_OAUTH_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: OUTLOOK_OAUTH_CONFIG.redirectUri,
      scope: OUTLOOK_SCOPES.join(' '),
      state,
      prompt: 'consent',
      response_mode: 'query',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${OUTLOOK_OAUTH_CONFIG.authorizeUrl}?${params}`;
    return res.json({success: true, data: {authUrl}});
  } catch (error) {
    console.error('[Outlook:Auth] URL error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** Retrieve and consume PKCE code_verifier for a given state */
export function consumeCodeVerifier(state) {
  const verifier = pkceStore.get(state);
  if (verifier) pkceStore.delete(state);
  return verifier;
}

/**
 * POST /api/outlook/auth/exchange — exchange code for Outlook tokens
 */
export async function exchangeOutlookCode(req, res) {
  try {
    const {code, state} = req.body;
    if (!code) {
      return res.status(400).json({success: false, error: 'code is required'});
    }

    const parsedState = state ? JSON.parse(state) : {};
    const storeId = parsedState.storeId || req.storeId || 'default';
    const userId = parsedState.userId || req.userId || 'default-user';

    // Retrieve PKCE code_verifier for this state
    const codeVerifier = consumeCodeVerifier(state);

    // Exchange code for tokens (SPA platform — public client with PKCE + Origin header)
    const tokenParams = {
      client_id: OUTLOOK_OAUTH_CONFIG.clientId,
      code,
      redirect_uri: OUTLOOK_OAUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier || ''
    };
    const body = new URLSearchParams(tokenParams);

    const tokenRes = await fetch(OUTLOOK_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': OUTLOOK_OAUTH_CONFIG.redirectUri
      },
      body
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err.error_description || 'Token exchange failed');
    }

    const tokens = await tokenRes.json();

    // Get user email from Graph API
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {Authorization: `Bearer ${tokens.access_token}`}
    });
    const profile = await profileRes.json();
    const email = profile.mail || profile.userPrincipalName;

    // Store in google_auth collection with outlook authType
    const authRepo = new GoogleAuthRepository();
    await authRepo.upsertByStoreAndEmail(storeId, userId, email, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
      authType: 'outlook'
    });

    // Auto-start Outlook watch after connecting (skip in local/emulator)
    const isLocal = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';
    try {
      if (isLocal) throw new Error('Skipping watch in local environment');
      const webhookUrl = `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/api/api/outlook/webhook`;
      const outlookService = new OutlookService(tokens.access_token);
      const subResult = await outlookService.createSubscription(webhookUrl);

      const watchRepo = new OutlookWatchRepository();
      await watchRepo.upsertWatch(email, storeId, userId, {
        subscriptionId: subResult.subscriptionId,
        watchExpiration: subResult.expiration,
        webhookUrl,
        status: 'active',
        lastSyncTime: new Date().toISOString(),
        renewalError: null
      });
      console.log(`[Outlook:Auth] Auto-started watch for ${email}`);
    } catch (watchErr) {
      console.warn(`[Outlook:Auth] Auto-watch failed for ${email}: ${watchErr.message}`);
    }

    return res.json({
      success: true,
      data: {googleEmail: email, authType: 'outlook'}
    });
  } catch (error) {
    console.error('[Outlook:Auth] Exchange error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/outlook/accounts — list Outlook-connected accounts
 */
export async function getOutlookAccounts(req, res) {
  try {
    const authRepo = new GoogleAuthRepository();
    const allAccounts = await authRepo.getAllByStoreAndUser(
      req.query.storeId || 'default',
      req.userId
    );
    const outlookAccounts = allAccounts.filter(a => a.authType === 'outlook');

    return res.json({
      success: true,
      data: outlookAccounts.map(a => ({
        email: a.googleEmail,
        authType: 'outlook',
        connectedAt: a.createdAt
      }))
    });
  } catch (error) {
    console.error('[Outlook:Auth] Accounts error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/outlook/disconnect — disconnect an Outlook account
 */
export async function disconnectOutlookAccount(req, res) {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400).json({success: false, error: 'email is required'});
    }

    // Stop watch if active
    const watchRepo = new OutlookWatchRepository();
    const watch = await watchRepo.getByEmail(email);
    if (watch?.subscriptionId) {
      try {
        const outlookService = await OutlookService.createForEmail(
          req.body.storeId || 'default',
          req.userId,
          email
        );
        await outlookService.deleteSubscription(watch.subscriptionId);
      } catch (err) {
        console.warn(`[Outlook:Auth] Failed to delete subscription: ${err.message}`);
      }
      await watchRepo.updateStatus(email, 'expired');
    }

    const authRepo = new GoogleAuthRepository();
    await authRepo.deleteByStoreAndEmail(req.body.storeId || 'default', req.userId, email);

    return res.json({success: true, data: {message: `Disconnected ${email}`}});
  } catch (error) {
    console.error('[Outlook:Auth] Disconnect error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
