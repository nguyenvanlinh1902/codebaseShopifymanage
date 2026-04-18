import crypto from 'crypto';
import {getFirestore} from 'firebase-admin/firestore';
import {OUTLOOK_OAUTH_CONFIG, OUTLOOK_SCOPES} from '../../config/outlook-oauth.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {OutlookService} from '../../services/outlook-service.js';
import {OutlookWatchRepository} from '../../repositories/outlook-watch-repository.js';

const PKCE_COLLECTION = 'pkce_verifiers';
const PKCE_TTL_MS = 10 * 60 * 1000;

/** Build backend callback URL from request (same-origin for confidential client) */
function getBackendCallbackUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/api/outlook/auth/callback`;
}

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * GET /api/outlook/auth-url — generate Outlook OAuth URL with PKCE
 * Cross-origin redemption (frontend redirect → backend exchange) requires PKCE
 */
export async function getOutlookAuthUrl(req, res) {
  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Use a unique key for Firestore lookup (not the full state JSON)
    const pkceKey = crypto.randomBytes(16).toString('hex');

    const stateObj = {
      pkceKey,
      userId: req.userId || '',
      storeId: req.query.storeId || 'default',
      mode: 'outlook'
    };
    const state = JSON.stringify(stateObj);

    // Persist code_verifier in Firestore (survives cold starts & multi-instance)
    const db = getFirestore();
    await db
      .collection(PKCE_COLLECTION)
      .doc(pkceKey)
      .set({
        codeVerifier,
        expiresAt: Date.now() + PKCE_TTL_MS
      });

    // Build backend callback URL (same-origin exchange avoids AADSTS90023)
    const callbackUrl = getBackendCallbackUrl(req);

    const params = new URLSearchParams({
      client_id: OUTLOOK_OAUTH_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: callbackUrl,
      scope: OUTLOOK_SCOPES.join(' '),
      state,
      prompt: 'consent',
      response_mode: 'query',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    // Pre-fill email for reconnect flow
    const loginHint = req.query.login_hint;
    if (loginHint) params.set('login_hint', loginHint);

    const authUrl = `${OUTLOOK_OAUTH_CONFIG.authorizeUrl}?${params}`;
    return res.json({success: true, data: {authUrl}});
  } catch (error) {
    console.error('[Outlook:Auth] URL error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * Exchange code for tokens (shared logic for callback and legacy exchange)
 */
async function exchangeCodeForTokens(code, parsedState, callbackUrl) {
  const storeId = parsedState.storeId || 'default';
  const userId = parsedState.userId || 'default-user';

  // Retrieve and consume PKCE code_verifier from Firestore
  let codeVerifier = '';
  if (parsedState.pkceKey) {
    const db = getFirestore();
    const docRef = db.collection(PKCE_COLLECTION).doc(parsedState.pkceKey);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      if (data.expiresAt > Date.now()) {
        codeVerifier = data.codeVerifier;
      }
      await docRef.delete();
    }
  }

  // Exchange code for tokens (confidential client — client_secret + PKCE)
  const body = new URLSearchParams({
    client_id: OUTLOOK_OAUTH_CONFIG.clientId,
    client_secret: OUTLOOK_OAUTH_CONFIG.clientSecret,
    code,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });

  const tokenRes = await fetch(OUTLOOK_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
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

  // Store tokens
  const authRepo = new GoogleAuthRepository();
  await authRepo.upsertByStoreAndEmail(storeId, userId, email, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
    authType: 'outlook',
    authStatus: 'active'
  });

  // Auto-start Outlook watch (skip in local/emulator)
  const isLocal =
    process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';
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

  return email;
}

/**
 * GET /api/outlook/auth/callback — Microsoft redirects here after consent
 * Exchanges code server-side (same-origin, no CORS issues), then sends postMessage to opener
 */
export async function handleOutlookCallback(req, res) {
  const {code, state, error: oauthError} = req.query;

  if (oauthError) {
    return res.send(buildPostMessageHtml(false, null, oauthError));
  }

  try {
    const parsedState = state ? JSON.parse(state) : {};
    const callbackUrl = getBackendCallbackUrl(req);
    const email = await exchangeCodeForTokens(code, parsedState, callbackUrl);

    return res.send(buildPostMessageHtml(true, email, null));
  } catch (err) {
    console.error('[Outlook:Auth] Callback error:', err.message);
    return res.send(buildPostMessageHtml(false, null, err.message));
  }
}

/** Build HTML that sends postMessage to opener window and closes popup */
function buildPostMessageHtml(success, email, error) {
  const data = JSON.stringify({
    type: 'outlook-auth-callback',
    success,
    email: email || '',
    error: error || ''
  });
  const msg = success ? 'Connected! Closing...' : 'Error: ' + (error || 'Unknown');
  return `<!DOCTYPE html><html><body><script>
    window.opener && window.opener.postMessage(${data}, '*');
    window.close();
  </script><p>${msg}</p></body></html>`;
}

/**
 * POST /api/outlook/auth/exchange — legacy exchange endpoint (kept for compatibility)
 */
export async function exchangeOutlookCode(req, res) {
  try {
    const {code, state} = req.body;
    if (!code) {
      return res.status(400).json({success: false, error: 'code is required'});
    }
    const parsedState = state ? JSON.parse(state) : {};
    const callbackUrl = getBackendCallbackUrl(req);
    const email = await exchangeCodeForTokens(code, parsedState, callbackUrl);

    return res.json({success: true, data: {googleEmail: email, authType: 'outlook'}});
  } catch (error) {
    console.error('[Outlook:Auth] Exchange error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/outlook/accounts — list Outlook-connected accounts
 * Admin sees all accounts, regular users see only their own
 */
export async function getOutlookAccounts(req, res) {
  try {
    const authRepo = new GoogleAuthRepository();
    const isAdmin = req.userRole === 'admin';
    const storeId = req.query.storeId || 'default';

    let allAccounts;
    if (isAdmin) {
      allAccounts = await authRepo.getAllByStore(storeId);
    } else {
      allAccounts = await authRepo.getAllByStoreAndUser(storeId, req.userId);
    }
    const outlookAccounts = allAccounts.filter(a => a.authType === 'outlook');

    return res.json({
      success: true,
      data: outlookAccounts.map(a => ({
        email: a.googleEmail,
        authType: 'outlook',
        userId: isAdmin ? a.userId : undefined,
        connectedAt: a.createdAt,
        lastRefreshed: a.updatedAt,
        authStatus: a.authStatus || 'active',
        linkedStoreIds: a.linkedStoreIds || []
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
    const storeId = req.body.storeId || 'default';
    // Find and delete by store + email (no userId restriction)
    const allInStore = await authRepo.getAllByStore(storeId);
    const record = allInStore.find(a => a.googleEmail === email && a.authType === 'outlook');
    if (record) await authRepo.collection.doc(record.id).delete();

    return res.json({success: true, data: {message: `Disconnected ${email}`}});
  } catch (error) {
    console.error('[Outlook:Auth] Disconnect error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
