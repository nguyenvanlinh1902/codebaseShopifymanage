import crypto from 'crypto';

// Must mock config before importing the module
jest.mock('../../config/shopify.js', () => ({
  default: {apiSecret: 'test-secret-key'}
}));

import {verifyWebhookHmac} from '../../middleware/verifyWebhookHmac.js';

describe('verifyWebhookHmac middleware', () => {
  let req, res, next;

  beforeEach(() => {
    next = jest.fn();
    res = createMockRes();
  });

  function generateHmac(body, secret = 'test-secret-key') {
    return crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
  }

  test('should pass with valid HMAC', () => {
    const body = JSON.stringify({shop_domain: 'test.myshopify.com'});
    const hmac = generateHmac(body);

    req = createMockReq({
      rawBody: body,
      body: {shop_domain: 'test.myshopify.com'},
      headers: {'X-Shopify-Hmac-Sha256': hmac}
    });

    verifyWebhookHmac(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should reject with invalid HMAC', () => {
    req = createMockReq({
      rawBody: JSON.stringify({shop_domain: 'test.myshopify.com'}),
      body: {shop_domain: 'test.myshopify.com'},
      headers: {'X-Shopify-Hmac-Sha256': 'invalid-hmac-value'}
    });

    verifyWebhookHmac(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('should reject with missing HMAC header', () => {
    req = createMockReq({
      rawBody: JSON.stringify({shop_domain: 'test.myshopify.com'}),
      body: {shop_domain: 'test.myshopify.com'},
      headers: {}
    });

    verifyWebhookHmac(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('should reject with wrong secret', () => {
    const body = JSON.stringify({shop_domain: 'test.myshopify.com'});
    const hmac = generateHmac(body, 'wrong-secret');

    req = createMockReq({
      rawBody: body,
      body: {shop_domain: 'test.myshopify.com'},
      headers: {'X-Shopify-Hmac-Sha256': hmac}
    });

    verifyWebhookHmac(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('should use JSON.stringify(body) when rawBody is missing', () => {
    const bodyObj = {shop_domain: 'test.myshopify.com'};
    const bodyStr = JSON.stringify(bodyObj);
    const hmac = generateHmac(bodyStr);

    req = createMockReq({
      body: bodyObj,
      headers: {'X-Shopify-Hmac-Sha256': hmac}
    });

    verifyWebhookHmac(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
