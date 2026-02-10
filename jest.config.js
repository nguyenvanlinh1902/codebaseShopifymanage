module.exports = {
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/functions/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/packages/functions/src/__tests__/setup.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', {presets: [['@babel/preset-env', {targets: {node: '20'}}]]}]
  },
  transformIgnorePatterns: ['node_modules/(?!firebase-admin|firebase-functions)']
};
