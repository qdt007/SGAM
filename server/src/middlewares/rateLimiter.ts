import rateLimit from 'express-rate-limit';
export const authLimiter = rateLimit({ windowMs: 60*1000, max: 10, message: { success: false, message: 'Too many requests.' }, standardHeaders: true, legacyHeaders: false });
export const registerLimiter = rateLimit({ windowMs: 60*1000, max: 5, message: { success: false, message: 'Too many registration attempts.' }, standardHeaders: true, legacyHeaders: false });
export const apiLimiter = rateLimit({ windowMs: 15*60*1000, max: 500, message: { success: false, message: 'Rate limit exceeded.' }, standardHeaders: true, legacyHeaders: false });
