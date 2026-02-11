import {Router} from 'express';
import * as productImportController from '../../controllers/productImportController.js';
import * as orderSyncController from '../../controllers/orderSyncController.js';
import * as sheetController from '../../controllers/sheetController.js';
import * as googleAuthController from '../../controllers/googleAuthController.js';

const router = new Router();

// Get all dashboard data in one call (optimization)
router.get('/', async (req, res) => {
  try {
    if (!req.store) {
      return res.status(404).json({success: false, error: 'Store not found'});
    }

    // Helper to create mock response that captures data
    const createMockRes = () => {
      let capturedData = null;
      return {
        json: data => {
          capturedData = data;
          return capturedData;
        },
        status: () => ({
          json: data => {
            capturedData = data;
            return capturedData;
          }
        }),
        data: () => capturedData
      };
    };

    // Create mock responses
    const productStatsMock = createMockRes();
    const syncConfigsMock = createMockRes();
    const sheetsMock = createMockRes();
    const googleStatusMock = createMockRes();

    // Fetch all data in parallel with proper mock objects
    await Promise.all([
      productImportController.getQueueStats({query: {storeId: req.store.id}}, productStatsMock),
      orderSyncController.getSyncConfigs({query: {storeId: req.store.id}}, syncConfigsMock),
      sheetController.getSheets({query: {storeId: req.store.id}}, sheetsMock),
      googleAuthController.checkGoogleAuth(
        {query: {storeId: req.store.id, userId: req.store.userId}},
        googleStatusMock
      )
    ]);

    // Extract captured data
    const productStatsRes = productStatsMock.data();
    const syncConfigsRes = syncConfigsMock.data();
    const sheetsRes = sheetsMock.data();
    const googleStatusRes = googleStatusMock.data();

    return res.json({
      success: true,
      data: {
        store: {
          id: req.store.id,
          name: req.store.name,
          shopDomain: req.store.shopDomain,
          email: req.store.email,
          status: req.store.status
        },
        productStats: productStatsRes?.data || null,
        syncConfigs: syncConfigsRes?.data || [],
        sheets: sheetsRes?.data || [],
        googleStatus: {
          connected:
            googleStatusRes?.data?.authenticated || googleStatusRes?.data?.connected || false
        }
      }
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

export default router;
