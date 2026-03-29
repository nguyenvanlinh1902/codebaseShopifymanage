import {OUTLOOK_OAUTH_CONFIG} from '../config/outlook-oauth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Outlook Service — wraps Microsoft Graph Mail API
 * Mirrors GmailService pattern using fetch instead of googleapis
 */
export class OutlookService {
  constructor(accessToken) {
    this._accessToken = accessToken;
  }

  /** Factory: create from stored auth record (auto-refreshes token) */
  static async createFromAuthRecord(authRecord) {
    const token = await refreshIfExpired(authRecord);
    return new OutlookService(token);
  }

  /** Factory: create for a specific email by store lookup */
  static async createForEmail(storeId, userId, email) {
    const {GoogleAuthRepository} = await import('../repositories/googleAuthRepository.js');
    const authRepo = new GoogleAuthRepository();
    // Lookup by store + email — no userId restriction
    const allInStore = await authRepo.getAllByStore(storeId);
    const authRecord = allInStore.find(a => a.googleEmail === email && a.authType === 'outlook');
    if (!authRecord) throw new Error(`No Outlook auth found for ${email}`);
    return OutlookService.createFromAuthRecord(authRecord);
  }

  async _fetch(path, options = {}) {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Graph API error: ${res.status}`);
    }
    return res.json();
  }

  /** List messages with optional search and pagination */
  async listMessages(query = '', maxResults = 50, skipToken = undefined) {
    const params = new URLSearchParams({
      $top: String(maxResults),
      $select:
        'id,conversationId,from,toRecipients,subject,bodyPreview,receivedDateTime,isRead,categories,inferenceClassification',
      $orderby: 'receivedDateTime desc'
    });
    if (query) params.set('$search', `"${query}"`);
    if (skipToken) params.set('$skiptoken', skipToken);

    const data = await this._fetch(`/me/messages?${params}`);
    const nextLink = data['@odata.nextLink'] || null;
    const nextToken = nextLink ? new URL(nextLink).searchParams.get('$skiptoken') : null;

    return {
      messages: (data.value || []).map(m => this._parseMessage(m)),
      nextPageToken: nextToken
    };
  }

  /** List messages in a specific folder */
  async listMessagesByFolder(folderId, maxResults = 50, skipToken = undefined) {
    const params = new URLSearchParams({
      $top: String(maxResults),
      $select:
        'id,conversationId,from,toRecipients,subject,bodyPreview,receivedDateTime,isRead,categories,inferenceClassification',
      $orderby: 'receivedDateTime desc'
    });
    if (skipToken) params.set('$skiptoken', skipToken);

    const data = await this._fetch(`/me/mailFolders/${folderId}/messages?${params}`);
    const nextLink = data['@odata.nextLink'] || null;
    const nextToken = nextLink ? new URL(nextLink).searchParams.get('$skiptoken') : null;

    return {
      messages: (data.value || []).map(m => this._parseMessage(m)),
      nextPageToken: nextToken
    };
  }

  /** Get single message metadata */
  async getMessage(messageId) {
    const data = await this._fetch(
      `/me/messages/${messageId}?$select=id,conversationId,from,toRecipients,subject,bodyPreview,receivedDateTime,isRead,categories,inferenceClassification`
    );
    return this._parseMessage(data);
  }

  /** Get full message with body */
  async getFullMessage(messageId) {
    const data = await this._fetch(`/me/messages/${messageId}`);
    const parsed = this._parseMessage(data);
    return {
      ...parsed,
      bodyText: data.body?.contentType === 'text' ? data.body.content : '',
      bodyHtml: data.body?.contentType === 'html' ? data.body.content : data.body?.content || ''
    };
  }

  /** List mail folders (equivalent to Gmail labels) */
  async listFolders() {
    const data = await this._fetch('/me/mailFolders?$top=100');
    return (data.value || []).map(f => ({
      id: f.id,
      name: f.displayName,
      type: f.isHidden ? 'system' : 'user'
    }));
  }

  /** Create subscription for push notifications (webhook) */
  async createSubscription(notificationUrl, expirationMinutes = 4230) {
    const expiration = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const data = await this._fetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl,
        resource: '/me/messages',
        expirationDateTime: expiration.toISOString(),
        clientState: 'outlook-watch-secret'
      })
    });
    return {
      subscriptionId: data.id,
      expiration: data.expirationDateTime
    };
  }

  /** Renew subscription */
  async renewSubscription(subscriptionId, expirationMinutes = 4230) {
    const expiration = new Date(Date.now() + expirationMinutes * 60 * 1000);
    const data = await this._fetch(`/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        expirationDateTime: expiration.toISOString()
      })
    });
    return {
      subscriptionId: data.id,
      expiration: data.expirationDateTime
    };
  }

  /** Delete subscription */
  async deleteSubscription(subscriptionId) {
    await fetch(`${GRAPH_BASE}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${this._accessToken}`}
    });
  }

  /** Parse Graph message into clean object matching Gmail format */
  _parseMessage(msg) {
    const from = msg.from?.emailAddress;
    const to = msg.toRecipients?.map(r => r.emailAddress?.address).join(', ') || '';

    return {
      id: msg.id,
      threadId: msg.conversationId || msg.id,
      from: from ? `${from.name || ''} <${from.address}>`.trim() : '',
      to,
      subject: msg.subject || '',
      snippet: msg.bodyPreview || '',
      date: msg.receivedDateTime || '',
      labels: msg.categories || [],
      isRead: msg.isRead ?? true,
      inboxType: msg.inferenceClassification || 'focused'
    };
  }
}

/** Refresh access token if expired */
async function refreshIfExpired(authRecord) {
  if (authRecord.expiryDate && Date.now() < authRecord.expiryDate - 60000) {
    return authRecord.accessToken;
  }

  const body = new URLSearchParams({
    client_id: OUTLOOK_OAUTH_CONFIG.clientId,
    client_secret: OUTLOOK_OAUTH_CONFIG.clientSecret,
    refresh_token: authRecord.refreshToken,
    grant_type: 'refresh_token'
  });

  const res = await fetch(OUTLOOK_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error('[Outlook:Refresh] Failed:', errBody.error, errBody.error_description);

    // Mark account as expired when grant is revoked/expired
    const isGrantExpired = errBody.error === 'invalid_grant' ||
      (errBody.error_description || '').includes('grant is expired');
    if (isGrantExpired) {
      const {GoogleAuthRepository} = await import('../repositories/googleAuthRepository.js');
      const authRepo = new GoogleAuthRepository();
      await authRepo.upsertByStoreAndEmail(
        authRecord.storeId, authRecord.userId, authRecord.googleEmail,
        {authStatus: 'expired'}
      );
    }

    const errMsg = errBody.error_description || errBody.error || res.status;
    const err = new Error(`Failed to refresh Outlook token: ${errMsg}`);
    err.code = isGrantExpired ? 'TOKEN_EXPIRED' : 'REFRESH_FAILED';
    throw err;
  }
  const tokens = await res.json();

  // Update stored tokens
  const {GoogleAuthRepository} = await import('../repositories/googleAuthRepository.js');
  const authRepo = new GoogleAuthRepository();
  await authRepo.upsertByStoreAndEmail(
    authRecord.storeId,
    authRecord.userId,
    authRecord.googleEmail,
    {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || authRecord.refreshToken,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scope: authRecord.scope,
      authType: 'outlook'
    }
  );

  return tokens.access_token;
}
