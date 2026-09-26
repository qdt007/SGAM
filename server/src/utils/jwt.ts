import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = (process.env.JWT_ACCESS_EXPIRES_IN as string) || '15m';
const REFRESH_EXPIRES = (process.env.JWT_REFRESH_EXPIRES_IN as string) || '7d';
export interface TokenPayload { userId: string; role: string; }
export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as SignOptions);
}
export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as SignOptions);
}
export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
  // A 2FA challenge is signed with this same secret, so it must be rejected here or it would
  // authenticate a caller who has not finished the second factor.
  if (decoded.purpose) throw new Error('Token is not an access token');
  return { userId: decoded.userId, role: decoded.role };
}
export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, REFRESH_SECRET) as JwtPayload;
  return { userId: decoded.userId };
}

/**
 * Short-lived token handed out when a password is correct but 2FA is still owed. It is signed
 * with the access secret but carries `purpose`, which verifyAccessToken never sets — so it
 * cannot be replayed as an access token, and an access token cannot stand in for it.
 */
const CHALLENGE_PURPOSE = '2fa';
const CHALLENGE_EXPIRES = '5m';

export function signTwoFactorChallenge(userId: string): string {
  return jwt.sign({ userId, purpose: CHALLENGE_PURPOSE }, ACCESS_SECRET, { expiresIn: CHALLENGE_EXPIRES } as SignOptions);
}

export function verifyTwoFactorChallenge(token: string): { userId: string } {
  const decoded = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
  if (decoded.purpose !== CHALLENGE_PURPOSE) throw new Error('Not a two-factor challenge token');
  return { userId: decoded.userId };
}

/**
 * CSRF guard for the OAuth round trip. Google echoes `state` back untouched, so signing it here
 * and checking the signature on the callback proves the redirect started from us.
 */
const OAUTH_PURPOSE = 'oauth-state';

export function signOAuthState(): string {
  return jwt.sign({ nonce: Math.random().toString(36).slice(2), purpose: OAUTH_PURPOSE }, ACCESS_SECRET, { expiresIn: '10m' } as SignOptions);
}

export function verifyOAuthState(state: string): void {
  const decoded = jwt.verify(state, ACCESS_SECRET) as JwtPayload;
  if (decoded.purpose !== OAUTH_PURPOSE) throw new Error('Not an OAuth state token');
}
