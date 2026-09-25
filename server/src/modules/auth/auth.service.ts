import prisma from '../../config/db';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
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
export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  if (!(await comparePassword(input.password, user.passwordHash))) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  const tokens = await issueTokens(user.id, user.globalRole);
  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, ...tokens };
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
