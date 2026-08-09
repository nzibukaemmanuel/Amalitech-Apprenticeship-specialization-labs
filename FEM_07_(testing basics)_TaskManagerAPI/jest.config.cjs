// Plain language: this is Jest's settings file - where to find tests, which
// source files count toward the coverage report, and the minimum coverage
// percentages the project must meet.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/models.js',
    'src/taskProcessor.js',
    'src/api.js',
    'src/cache.js',
    'src/rateLimiter.js',
    'src/errors.js',
    'src/exporter.js',
    'src/taskManager.js',
    // Deliberately excluded from coverage (documented in TESTING_DOCUMENTATION.md):
    //   src/main.js  - Node CLI: readline prompts + process I/O, thin wiring
    //   app.js       - browser DOM wiring, needs a browser/jsdom, not core logic
    //   server.js    - static file server, infrastructure, not business logic
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 85,
      lines: 80,
    },
  },
};
