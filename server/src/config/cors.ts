type OriginCallback = (err: Error | null, allow?: boolean) => void;
export type OriginFn = (origin: string | undefined, cb: OriginCallback) => void;

/** CLIENT_URL is a comma-separated list so prod and a custom domain can both be allowed. */
function configured(): string[] {
  return (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

/**
 * The origins a Capacitor build reports. Android serves the bundled app from https://localhost
 * and iOS from capacitor://localhost — there is no way to configure these away, so an API the
 * mobile app can reach has to name them.
 *
 * Safe here because this API authenticates with a Bearer token in a header, not a cookie: a
 * hostile page cannot ride an existing session, and the token lives in the app's own storage
 * where no other origin can read it. On a cookie-authenticated API this would be a real hole.
 */
const NATIVE_ORIGINS = ['capacitor://localhost', 'http://localhost', 'https://localhost'];

// Every Vercel preview deploy gets its own hostname, so an allowlist can never name them all.
// Off by default — turn it on only while you actually need to demo from a preview build.
const PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;
const allowPreviews = (): boolean => process.env.ALLOW_VERCEL_PREVIEWS === 'true';

export function isAllowedOrigin(origin: string | undefined): boolean {
  // No Origin header at all: curl, health checks, server-to-server. Not a browser, nothing to guard.
  if (!origin) return true;
  const o = origin.replace(/\/$/, '');
  return configured().includes(o) || NATIVE_ORIGINS.includes(o) || (allowPreviews() && PREVIEW.test(o));
}

/** Shared by the Express CORS middleware and the Socket.io handshake so they never drift apart. */
export function allowedOrigins(): OriginFn {
  return (origin, cb) =>
    isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`Origin not allowed by CORS: ${origin}`));
}
