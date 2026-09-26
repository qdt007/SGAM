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

export const twoFactorTokenSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});
export const twoFactorVerifySchema = z.object({
  challengeToken: z.string().min(1),
  // Either a 6-digit TOTP or a 10-character recovery code, so this only rejects obvious junk.
  code: z.string().min(6).max(20),
});
export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Enter your password to turn this off'),
});
export type TwoFactorTokenInput = z.infer<typeof twoFactorTokenSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;
