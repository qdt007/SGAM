import { z } from 'zod';

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
