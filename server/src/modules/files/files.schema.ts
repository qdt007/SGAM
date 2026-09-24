import { z } from 'zod';

/** Multipart bodies carry no JSON fields we validate; this covers the optional attach-to-comment case. */
export const attachFileSchema = z.object({
  commentId: z.string().uuid().optional(),
});

export type AttachFileInput = z.infer<typeof attachFileSchema>;
