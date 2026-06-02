import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ success: false, message: 'No token provided', code: 'NO_TOKEN' }); return; }
  const token = authHeader.slice(7);
  try { req.user = verifyAccessToken(token); next(); }
  catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({ success: false, message: isExpired ? 'Token expired' : 'Invalid token', code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN' });
  }
}
