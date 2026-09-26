import prisma from '../../config/db';
import { hashPassword, comparePassword } from '../../utils/hash';
import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken, signTwoFactorChallenge, verifyTwoFactorChallenge } from '../../utils/jwt';
import { RegisterInput, LoginInput } from './auth.schema';
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
async function issueTokens(userId: string, role: string) {
  const accessToken = signAccessToken(userId, role);
  const refreshToken = signRefreshToken(userId);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId, expiresAt: new Date(Date.now() + REFRESH_MS) } });
  return { accessToken, refreshToken };
}
export async function register(input: RegisterInput) {
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: input.email }, { username: input.username }] } });
  if (existing) throw Object.assign(new Error(`This ${existing.email === input.email ? 'email' : 'username'} is already taken`), { status: 409 });
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({ data: { email: input.email, username: input.username, passwordHash, displayName: input.displayName }, select: { id: true, email: true, username: true, displayName: true, globalRole: true, createdAt: true } });
  const tokens = await issueTokens(user.id, user.globalRole);
  return { user, ...tokens };
}
/** Either a finished session, or a demand for the second factor. Spelled out so callers can
 *  narrow on `requiresTwoFactor`; inference collapses the two into one loose shape. */
export type SignInResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { user: Record<string, unknown>; accessToken: string; refreshToken: string };

/** Strips every secret column. Spreading the row would leak the 2FA secret to the client. */
function toSafeUser(user: { passwordHash: string | null; twoFactorSecret: string | null; twoFactorBackupCodes: string[] } & Record<string, unknown>) {
  const { passwordHash: _p, twoFactorSecret: _s, twoFactorBackupCodes: _b, ...safe } = user;
  return safe;
}

export async function login(input: LoginInput): Promise<SignInResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  // A Google-created account has no password. Say so instead of "invalid credentials", which
  // would send someone off resetting a password that never existed.
  if (!user.passwordHash) {
    throw Object.assign(new Error('This account signs in with Google. Use the Google button.'), { status: 409 });
  }
  if (!(await comparePassword(input.password, user.passwordHash))) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  // Password was right but it is only half the login: hand back a challenge, not a session.
  if (user.twoFactorEnabled) {
    return { requiresTwoFactor: true as const, challengeToken: signTwoFactorChallenge(user.id) };
  }

  const tokens = await issueTokens(user.id, user.globalRole);
  return { user: toSafeUser(user), ...tokens };
}
export async function refreshTokens(token: string) {
  const payload = verifyRefreshToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, globalRole: true, isActive: true } });
  if (!user || !user.isActive) throw Object.assign(new Error('User not found'), { status: 401 });
  return issueTokens(user.id, user.globalRole);
}
export async function logout(token: string): Promise<void> { await prisma.refreshToken.deleteMany({ where: { token } }); }
/** Drops every refresh token the user holds, so all other devices fall out at their next refresh. */
export async function logoutEverywhere(userId: string): Promise<number> {
  const { count } = await prisma.refreshToken.deleteMany({ where: { userId } });
  return count;
}
export async function getMe(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, globalRole: true, createdAt: true } });
}

/* ─── Two-factor authentication ──────────────────────────── */

const APP_NAME = 'SGAM';
const BACKUP_CODE_COUNT = 8;
// One step of clock drift either way; without it a phone a few seconds off is rejected.
const TOTP_TOLERANCE_SECONDS = 30;

function newBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
}

/**
 * Starts enrolment: stores a secret but leaves 2FA off until a code proves the authenticator
 * actually holds it. Calling this again before enabling replaces the half-finished secret.
 */
export async function startTwoFactorSetup(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.twoFactorEnabled) throw Object.assign(new Error('Two-factor authentication is already on'), { status: 409 });

  const secret = generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

  const uri = generateURI({ secret, label: user.email, issuer: APP_NAME });
  return { secret, otpauthUrl: uri, qrDataUrl: await QRCode.toDataURL(uri) };
}

/** Confirms the authenticator works, turns 2FA on and returns the recovery codes once. */
export async function enableTwoFactor(userId: string, token: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true, twoFactorEnabled: true } });
  if (!user?.twoFactorSecret) throw Object.assign(new Error('Start the setup first'), { status: 400 });
  if (user.twoFactorEnabled) throw Object.assign(new Error('Two-factor authentication is already on'), { status: 409 });
  if (!verifySync({ token, secret: user.twoFactorSecret, epochTolerance: TOTP_TOLERANCE_SECONDS }).valid) {
    throw Object.assign(new Error('That code is not right. Check the app and try again.'), { status: 400 });
  }

  const codes = newBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: await Promise.all(codes.map((c) => hashPassword(c))),
    },
  });
  // The only time the plaintext exists outside the user's hands.
  return { backupCodes: codes };
}

/** Turning 2FA off needs the password, so a borrowed open session cannot weaken the account. */
export async function disableTwoFactor(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (!user.passwordHash) {
    throw Object.assign(new Error('This account has no password. Set one before turning 2FA off.'), { status: 409 });
  }
  if (!(await comparePassword(password, user.passwordHash))) {
    throw Object.assign(new Error('That password is not right'), { status: 400 });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
  });
}

/** Second half of login: a TOTP code, or one recovery code which is then burned. */
export async function verifyTwoFactorLogin(challengeToken: string, code: string) {
  let userId: string;
  try {
    ({ userId } = verifyTwoFactorChallenge(challengeToken));
  } catch {
    throw Object.assign(new Error('This sign-in attempt expired. Enter your password again.'), { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const cleaned = code.replace(/\s/g, '');
  // verifySync throws TokenLengthError on anything that is not six digits rather than returning
  // invalid, so only hand it a TOTP-shaped code and treat everything else as a recovery code.
  const looksLikeTotp = /^\d{6}$/.test(cleaned);
  const totpAccepted =
    looksLikeTotp && verifySync({ token: cleaned, secret: user.twoFactorSecret, epochTolerance: TOTP_TOLERANCE_SECONDS }).valid;

  if (!totpAccepted) {
    const upper = cleaned.toUpperCase();
    let matched = -1;
    for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
      if (await comparePassword(upper, user.twoFactorBackupCodes[i])) { matched = i; break; }
    }
    if (matched === -1) throw Object.assign(new Error('That code is not right'), { status: 401 });
    // Single use: drop the one that was just spent.
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: user.twoFactorBackupCodes.filter((_, i) => i !== matched) },
    });
  }

  const tokens = await issueTokens(user.id, user.globalRole);
  return { user: toSafeUser(user), ...tokens };
}

/** What Settings needs to render the section without exposing the secret. */
export async function getTwoFactorStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return { enabled: user.twoFactorEnabled, backupCodesLeft: user.twoFactorBackupCodes.length };
}

/* ─── Google sign-in ─────────────────────────────────────── */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function callbackUrl(): string {
  return process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
}

/** The URL the browser is sent to. `state` is a signed nonce so the callback cannot be forged. */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

interface GoogleProfile { sub: string; email: string; email_verified: boolean; name?: string; picture?: string }

async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw Object.assign(new Error('Google rejected the sign-in'), { status: 401 });
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw Object.assign(new Error('Google returned no access token'), { status: 401 });

  const profileRes = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!profileRes.ok) throw Object.assign(new Error('Could not read your Google profile'), { status: 401 });
  return (await profileRes.json()) as GoogleProfile;
}

/** Turns a username candidate into something that fits the column and is not already taken. */
async function freeUsername(seed: string): Promise<string> {
  const base = (seed.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user').slice(0, 24);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    if (!(await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Completes the callback: links to an existing account by email, or creates one.
 *
 * Linking trusts `email_verified`. Without that check anyone could register an unverified
 * Google account on someone else's address and take over their account here.
 */
export async function loginWithGoogle(code: string): Promise<SignInResult> {
  const profile = await fetchGoogleProfile(code);
  if (!profile.email) throw Object.assign(new Error('Your Google account has no email address'), { status: 400 });

  let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });

  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      if (!profile.email_verified) {
        throw Object.assign(new Error('Google has not verified that email address'), { status: 403 });
      }
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: profile.sub } });
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.sub,
          username: await freeUsername(profile.email.split('@')[0]),
          displayName: profile.name || profile.email.split('@')[0],
          avatarUrl: profile.picture ?? null,
        },
      });
    }
  }

  if (!user.isActive) throw Object.assign(new Error('This account is disabled'), { status: 403 });

  // Google proving who they are does not stand in for the second factor they chose to require.
  if (user.twoFactorEnabled) {
    return { requiresTwoFactor: true as const, challengeToken: signTwoFactorChallenge(user.id) };
  }

  const tokens = await issueTokens(user.id, user.globalRole);
  return { user: toSafeUser(user), ...tokens };
}
