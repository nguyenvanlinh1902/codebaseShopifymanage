import {Router} from 'express';
import * as googleAuthController from '../../controllers/googleAuthController.js';

const router = new Router();

// Wrapped to match frontend expected response shape
router.get('/auth-url', async (req, res) => {
  const originalJson = res.json.bind(res);
  res.json = data => {
    if (data.success && data.data?.authUrl) {
      data.data.url = data.data.authUrl;
    }
    return originalJson(data);
  };
  return googleAuthController.getGoogleAuthUrl(req, res);
});

router.get('/status', async (req, res) => {
  const originalJson = res.json.bind(res);
  res.json = data => {
    if (data.success && data.data) {
      data.data.connected = data.data.authenticated || false;
    }
    return originalJson(data);
  };
  return googleAuthController.checkGoogleAuth(req, res);
});

router.post('/disconnect', (req, res) => {
  if (req.store) {
    if (!req.body || typeof req.body !== 'object') req.body = {};
    req.body.storeId = req.store.id;
    req.body.userId = req.store.userId || req.userId || 'default-user';
  }
  return googleAuthController.disconnectGoogle(req, res);
});

router.get('/picker-token', googleAuthController.getPickerToken);

export default router;
