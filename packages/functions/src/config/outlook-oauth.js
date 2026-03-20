/**
 * Outlook/Hotmail OAuth Configuration — Microsoft identity platform
 * Requires Azure AD app registration
 */
export const OUTLOOK_OAUTH_CONFIG = {
  clientId: process.env.OUTLOOK_CLIENT_ID,
  clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
  redirectUri: process.env.OUTLOOK_REDIRECT_URI,
  authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
};

export const OUTLOOK_SCOPES = ['Mail.Read', 'User.Read', 'offline_access'];
