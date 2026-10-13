import { z } from 'zod';

const body = z.string().trim().min(1, 'A message cannot be empty').max(4000);

export const createMessageSchema = z.object({
  body,
  /**
   * Pinning is what makes a message an announcement: everyone in the project is notified rather
   * than only the people who were @mentioned, so it is deliberately a separate decision from
   * writing the message.
   */
  pinned: z.boolean().optional(),
});

export const updateMessageSchema = z
  .object({ body: body.optional(), pinned: z.boolean().optional() })
  .refine((v) => v.body !== undefined || v.pinned !== undefined, { message: 'Nothing to update' });

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
