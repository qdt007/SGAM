import { z } from 'zod';
import { BlockerImpact, BlockerStatus } from '@prisma/client';

export const createBlockerSchema = z.object({
  title: z.string().trim().min(1, 'Describe the difficulty in a few words').max(200),
  description: z.string().trim().max(4000).optional(),
  impact: z.nativeEnum(BlockerImpact).optional(),
  /** The task it is holding up, when it is only one. */
  taskId: z.string().uuid().optional().nullable(),
});

export const updateBlockerSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).optional().nullable(),
    impact: z.nativeEnum(BlockerImpact).optional(),
    taskId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/**
 * Resolving asks for what was done about it. Optional, because forcing a sentence out of someone
 * is how you get "done" written four hundred times, but asked for every time because a blocker
 * with no resolution teaches the team nothing after the fact.
 */
export const resolveBlockerSchema = z.object({
  resolution: z.string().trim().max(4000).optional(),
});

export const listBlockersSchema = z.object({
  status: z.nativeEnum(BlockerStatus).optional(),
});

export type CreateBlockerInput = z.infer<typeof createBlockerSchema>;
export type UpdateBlockerInput = z.infer<typeof updateBlockerSchema>;
export type ResolveBlockerInput = z.infer<typeof resolveBlockerSchema>;
