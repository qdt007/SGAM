import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // app.ts reads env at import time; tests must not start morgan or the rate limiter's clock.
    env: { NODE_ENV: 'test' },
  },
});
