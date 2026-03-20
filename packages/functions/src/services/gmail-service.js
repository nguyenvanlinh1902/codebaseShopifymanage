import {google} from 'googleapis';
import {GMAIL_OAUTH_CONFIG} from '../config/gmail-oauth.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';

/**
 * Gmail Service — wraps googleapis gmail v1 client
 * Follows GoogleSheetsService factory pattern
 */
export class GmailService {
  constructor(oauth2Client) {
    this._oauth2Client = oauth2Client;
    this._gmail = null;
  }

  get gmail() {
    if (!this._gmail) {
      this._gmail = google.gmail({version: 'v1', auth: this._oauth2Client});
    }
    return this._gmail;
  }

  /**
   * Factory: create from stored auth record (refresh token auto-refresh)
   */
  static createFromAuthRecord(authRecord) {
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_OAUTH_CONFIG.clientId,
      GMAIL_OAUTH_CONFIG.clientSecret,
      GMAIL_OAUTH_CONFIG.redirectUri
    );
    oauth2Client.setCredentials({refresh_token: authRecord.refreshToken});
    return new GmailService(oauth2Client);
  }

  /**
   * Factory: create for a specific email by store+user lookup
   */
  static async createForEmail(storeId, userId, googleEmail) {
    const authRepo = new GoogleAuthRepository();
    const authRecord = await authRepo.getByStoreUserAndEmail(storeId, userId, googleEmail);
    if (!authRecord) {
      throw new Error(`No Google auth found for ${googleEmail}`);
    }
    return GmailService.createFromAuthRecord(authRecord);
  }

  /**
   * List messages with optional search query
   */
  async listMessages(query = '', maxResults = 50, pageToken = undefined) {
    const params = {userId: 'me', maxResults};
    if (query) params.q = query;
    if (pageToken) params.pageToken = pageToken;

    const res = await this.gmail.users.messages.list(params);
    const messageList = res.data.messages || [];

    // Fetch metadata for each message
    const messages = await Promise.all(
      messageList.map(m => this.getMessage(m.id, 'metadata'))
    );

    return {messages, nextPageToken: res.data.nextPageToken || null};
  }

  /**
   * Get single message (metadata or minimal format)
   */
  async getMessage(messageId, format = 'metadata') {
    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format
    });
    return this._parseMessage(res.data);
  }

  /**
   * Get full message with body extracted
   */
  async getFullMessage(messageId) {
    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    const parsed = this._parseMessage(res.data);
    const body = this._extractBody(res.data.payload);
    return {...parsed, bodyText: body.text, bodyHtml: body.html};
  }

  /**
   * List Gmail labels
   */
  async listLabels() {
    const res = await this.gmail.users.labels.list({userId: 'me'});
    return (res.data.labels || []).map(l => ({
      id: l.id,
      name: l.name,
      type: l.type
    }));
  }

  /**
   * Start watching mailbox for push notifications
   */
  async watchMailbox(topicName) {
    const res = await this.gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX']
      }
    });
    return {
      historyId: res.data.historyId,
      expiration: new Date(parseInt(res.data.expiration)).toISOString()
    };
  }

  /**
   * Stop watching mailbox
   */
  async stopWatch() {
    await this.gmail.users.stop({userId: 'me'});
  }

  /**
   * List history since a historyId
   */
  async listHistory(startHistoryId) {
    const res = await this.gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded']
    });
    return {
      history: res.data.history || [],
      historyId: res.data.historyId
    };
  }

  /**
   * Parse Gmail message into a clean object
   */
  _parseMessage(msg) {
    const headers = msg.payload?.headers || [];
    const getHeader = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: msg.id,
      threadId: msg.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      snippet: msg.snippet || '',
      date: getHeader('Date'),
      labels: msg.labelIds || [],
      isRead: !msg.labelIds?.includes('UNREAD')
    };
  }

  /**
   * Extract text/html body from multipart MIME payload
   */
  _extractBody(payload) {
    const result = {text: '', html: ''};
    if (!payload) return result;

    const extractPart = part => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        result.text = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        result.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        part.parts.forEach(extractPart);
      }
    };

    // Single-part message
    if (payload.body?.data) {
      if (payload.mimeType === 'text/html') {
        result.html = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else {
        result.text = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }
    }

    // Multipart message
    if (payload.parts) {
      payload.parts.forEach(extractPart);
    }

    return result;
  }
}
