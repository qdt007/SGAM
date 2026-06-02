import { z } from 'zod';
export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
