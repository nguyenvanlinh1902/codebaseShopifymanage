import 'dotenv/config';

export default {
  isProduction: process.env.APP_ENV === 'production',
  baseUrl: process.env.APP_BASE_URL || ''
};
