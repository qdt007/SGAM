import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ZodError } from 'zod';
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') { res.status(404).json({ success: false, message: 'Resource not found' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ success: false, message: `Duplicate value` }); return; }
    if (err.code === 'P2003') { res.status(400).json({ success: false, message: 'Related resource not found' }); return; }
  }
  if (err instanceof TokenExpiredError) { res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' }); return; }
  if (err instanceof JsonWebTokenError) { res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' }); return; }
  if (err instanceof ZodError) { res.status(422).json({ success: false, message: 'Validation failed', errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) }); return; }
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err instanceof Error ? err.message : String(err));
  console.error('[ErrorHandler]', err);
  res.status(500).json({ success: false, message });
}
