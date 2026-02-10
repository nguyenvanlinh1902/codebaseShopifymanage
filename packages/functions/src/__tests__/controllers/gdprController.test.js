import '../../__tests__/setup.js';

// Mock the firestore before importing
jest.mock('firebase-admin/firestore');

import * as gdprController from '../../controllers/gdprController.js';

describe('GDPR Controller', () => {
  let res;

  beforeEach(() => {
    res = createMockRes();
    jest.clearAllMocks();
  });

  describe('handleCustomerDataRequest', () => {
    test('should return 200 OK', async () => {
      const req = createMockReq({
        body: {
          shop_domain: 'test.myshopify.com',
          customer: {id: 123, email: 'customer@example.com'},
          orders_requested: [1001, 1002]
        }
      });

      await gdprController.handleCustomerDataRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({success: true});
    });

    test('should return 200 even on error', async () => {
      const req = createMockReq({body: {}});

      await gdprController.handleCustomerDataRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handleCustomerRedact', () => {
    test('should return 200 OK', async () => {
      const req = createMockReq({
        body: {
          shop_domain: 'test.myshopify.com',
          customer: {id: 456, email: 'delete@example.com'},
          orders_to_redact: [2001]
        }
      });

      await gdprController.handleCustomerRedact(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({success: true});
    });

    test('should return 200 even on error', async () => {
      const req = createMockReq({body: {}});

      await gdprController.handleCustomerRedact(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handleShopRedact', () => {
    test('should return 200 OK', async () => {
      const req = createMockReq({
        body: {
          shop_domain: 'test.myshopify.com',
          shop_id: 12345
        }
      });

      await gdprController.handleShopRedact(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({success: true});
    });

    test('should return 200 even on error', async () => {
      const req = createMockReq({body: {}});

      await gdprController.handleShopRedact(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
