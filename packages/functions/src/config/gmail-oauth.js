/**
 * Gmail OAuth Configuration — separate from Google Sheets
 * Uses same Google OAuth app but different scopes and redirect
 */
export const GMAIL_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GMAIL_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI
};

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];
