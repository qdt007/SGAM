/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true }, '/uploads': { target: 'http://localhost:5000', changeOrigin: true } } },
});
