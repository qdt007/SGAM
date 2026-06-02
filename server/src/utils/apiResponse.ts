import { Response } from 'express';
export interface Meta { total?: number; page?: number; limit?: number; totalPages?: number; [key: string]: unknown; }
export function success<T>(res: Response, data: T, statusCode = 200, meta?: Meta): Response {
  return res.status(statusCode).json({ success: true, data, ...(meta && { meta }) });
}
export function error(res: Response, message: string, statusCode = 400, errors?: unknown): Response {
  return res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
}
