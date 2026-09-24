import { z } from 'zod';

export const burndownQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type BurndownQuery = z.infer<typeof burndownQuerySchema>;
