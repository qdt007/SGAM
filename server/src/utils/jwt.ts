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
  return { userId: decoded.userId, role: decoded.role };
}
export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, REFRESH_SECRET) as JwtPayload;
  return { userId: decoded.userId };
}
