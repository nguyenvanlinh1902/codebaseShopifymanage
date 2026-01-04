import 'dotenv/config';

export default {
  isProduction: process.env.APP_ENV === 'production',
  isLocal: process.env.APP_ENV === 'local',
  baseUrl: process.env.APP_BASE_URL || ''
};
