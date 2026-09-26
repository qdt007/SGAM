import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // app.ts reads env at import time; tests must not start morgan or the rate limiter's clock.
    // The Google values are dummies so the OAuth routes are exercised without real credentials —
    // nothing here ever reaches Google, only the redirect this server builds is inspected.
    env: {
      NODE_ENV: 'test',
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/auth/google/callback',
      CLIENT_URL: 'http://localhost:5173',
    },
  },
});
