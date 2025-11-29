import 'dotenv/config';

export default {
  secret: process.env.SHOPIFY_SECRET || '',
  apiKey: process.env.SHOPIFY_API_KEY || '',
  firebaseApiKey: process.env.SHOPIFY_FIREBASE_API_KEY || '',
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_themes'],
  accessTokenKey: process.env.SHOPIFY_ACCESS_TOKEN_KEY || 'avada-apps-access-token'
};
