/**
 * Jest test setup - mocks for Firebase, Shopify, etc.
 */

// Mock Firebase Admin
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({empty: true, docs: [], forEach: jest.fn()}),
  add: jest.fn().mockResolvedValue({id: 'mock-doc-id', update: jest.fn()}),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  batch: jest.fn(() => ({
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue({})
  }))
};

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApp: jest.fn()
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestore)
}));

// Export mocks for test files to use
global.__mockFirestore = mockFirestore;

// Helper to create mock Express req/res
global.createMockReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  get: jest.fn(header => (overrides.headers || {})[header]),
  rawBody: '',
  ...overrides
});

global.createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};
