import { z } from 'zod';

export const updateUserSchema = z
  .object({
    globalRole: z.enum(['ADMIN', 'USER']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.globalRole !== undefined || d.isActive !== undefined, {
    message: 'Nothing to change',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
