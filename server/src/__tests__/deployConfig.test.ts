import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAllowedOrigin } from '../config/cors';
import { resourceTypeFor } from '../config/storage';

const ORIGINAL = { ...process.env };
beforeEach(() => { delete process.env.CLIENT_URL; delete process.env.ALLOW_VERCEL_PREVIEWS; });
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('isAllowedOrigin', () => {
  it('falls back to the vite dev server when CLIENT_URL is unset', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(false);
  });

  it('accepts every entry of a comma-separated CLIENT_URL', () => {
    process.env.CLIENT_URL = 'https://pm.vercel.app, https://pm.example.com';
    expect(isAllowedOrigin('https://pm.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://pm.example.com')).toBe(true);
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
  });

  it('ignores a trailing slash on either side', () => {
    process.env.CLIENT_URL = 'https://pm.vercel.app/';
    expect(isAllowedOrigin('https://pm.vercel.app')).toBe(true);
  });

  it('lets through requests with no Origin header (health checks, curl)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it('only allows vercel previews when the flag is on', () => {
    process.env.CLIENT_URL = 'https://pm.vercel.app';
    expect(isAllowedOrigin('https://pm-git-feat-x.vercel.app')).toBe(false);
    process.env.ALLOW_VERCEL_PREVIEWS = 'true';
    expect(isAllowedOrigin('https://pm-git-feat-x.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://pm.vercel.app.evil.com')).toBe(false);
  });
});

describe('resourceTypeFor', () => {
  it('sends raster images to the image API', () => {
    for (const m of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      expect(resourceTypeFor(m)).toBe('image');
    }
  });

  it('keeps pdf, svg and documents on raw so downloads come back untransformed', () => {
    for (const m of ['application/pdf', 'image/svg+xml', 'application/zip', 'text/csv']) {
      expect(resourceTypeFor(m)).toBe('raw');
    }
  });
});
