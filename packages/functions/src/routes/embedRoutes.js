import {Router} from 'express';
import {verifyShopifySession} from '../middleware/verifyShopifySession.js';
import storeRoutes from './embed-routes/store-routes.js';
import dashboardRoutes from './embed-routes/dashboard-routes.js';
import productRoutes from './embed-routes/product-routes.js';
import orderRoutes from './embed-routes/order-routes.js';
import googleAuthRoutes from './embed-routes/google-auth-routes.js';
import sheetRoutes from './embed-routes/sheet-routes.js';

const router = new Router();

// All embedded routes require session token verification
router.use(verifyShopifySession);

// Inject storeId from session into request for downstream controllers
router.use((req, res, next) => {
  if (req.store) {
    req.query.storeId = req.store.id;
    req.query.userId = req.store.userId || 'default-user';
    req.userId = req.store.userId || 'default-user';
    if (req.body && typeof req.body === 'object') {
      req.body.storeId = req.store.id;
      req.body.userId = req.store.userId || 'default-user';
    }
  }
  next();
});

// Mount sub-routers
router.use('/store', storeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/google', googleAuthRoutes);
router.use('/sheets', sheetRoutes);

export default router;
