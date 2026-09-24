import { z } from 'zod';

export const stopTimerSchema = z.object({
  timeLogId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export const logManualSchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  note: z.string().max(500).optional(),
}).refine((d) => new Date(d.endedAt) > new Date(d.startedAt), {
  message: 'endedAt must be after startedAt', path: ['endedAt'],
});

export const updateTimeLogSchema = z.object({
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  note: z.string().max(500).optional().nullable(),
});

export type StopTimerInput = z.infer<typeof stopTimerSchema>;
export type LogManualInput = z.infer<typeof logManualSchema>;
export type UpdateTimeLogInput = z.infer<typeof updateTimeLogSchema>;
