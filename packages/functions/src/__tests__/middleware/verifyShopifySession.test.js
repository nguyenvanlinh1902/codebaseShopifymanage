import crypto from 'crypto';

const TEST_SECRET = 'test-api-secret';

// Mock config
jest.mock('../../config/shopify.js', () => ({
  default: {apiSecret: 'test-api-secret'}
}));

// Mock store repository
jest.mock('../../repositories/storeRepository.js', () => ({
  StoreRepository: jest.fn().mockImplementation(() => ({
    getByShopDomain: jest.fn().mockResolvedValue({id: 'store-1', shopDomain: 'test-store'})
  }))
}));

import {verifyShopifySession} from '../../middleware/verifyShopifySession.js';

function createJwt(payload, secret = TEST_SECRET) {
  const header = Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

describe('verifyShopifySession middleware', () => {
  let res, next;

  beforeEach(() => {
    res = createMockRes();
    next = jest.fn();
  });

  test('should pass with valid token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createJwt({
      iss: 'https://test-store.myshopify.com/admin',
      dest: 'https://test-store.myshopify.com',
      exp: now + 3600,
      nbf: now - 10
    });

    const req = createMockReq({
      headers: {'Authorization': `Bearer ${token}`}
    });

    verifyShopifySession(req, res, next);

    // Wait for async store lookup
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(req.shopDomain).toBe('test-store');
    expect(next).toHaveBeenCalled();
  });

  test('should reject missing Authorization header', () => {
    const req = createMockReq({headers: {}});

    verifyShopifySession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should reject expired token', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createJwt({
      iss: 'https://test-store.myshopify.com/admin',
      dest: 'https://test-store.myshopify.com',
      exp: now - 3600,
      nbf: now - 7200
    });

    const req = createMockReq({
      headers: {'Authorization': `Bearer ${token}`}
    });

    verifyShopifySession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error: 'Token expired'}));
  });

  test('should reject invalid signature', () => {
    const token = createJwt({
      iss: 'https://test-store.myshopify.com/admin',
      dest: 'https://test-store.myshopify.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    }, 'wrong-secret');

    const req = createMockReq({
      headers: {'Authorization': `Bearer ${token}`}
    });

    verifyShopifySession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error: 'Invalid token signature'}));
  });

  test('should reject malformed token', () => {
    const req = createMockReq({
      headers: {'Authorization': 'Bearer not.a.valid.token.format'}
    });

    verifyShopifySession(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
