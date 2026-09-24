type OriginCallback = (err: Error | null, allow?: boolean) => void;
export type OriginFn = (origin: string | undefined, cb: OriginCallback) => void;

/** CLIENT_URL is a comma-separated list so prod and a custom domain can both be allowed. */
function configured(): string[] {
  return (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

// Every Vercel preview deploy gets its own hostname, so an allowlist can never name them all.
// Off by default — turn it on only while you actually need to demo from a preview build.
const PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;
const allowPreviews = (): boolean => process.env.ALLOW_VERCEL_PREVIEWS === 'true';

export function isAllowedOrigin(origin: string | undefined): boolean {
  // No Origin header at all: curl, health checks, server-to-server. Not a browser, nothing to guard.
  if (!origin) return true;
  const o = origin.replace(/\/$/, '');
  return configured().includes(o) || (allowPreviews() && PREVIEW.test(o));
}

/** Shared by the Express CORS middleware and the Socket.io handshake so they never drift apart. */
export function allowedOrigins(): OriginFn {
  return (origin, cb) =>
    isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`Origin not allowed by CORS: ${origin}`));
}
