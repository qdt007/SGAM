import { z } from 'zod';

/* One schema for both the create and the edit modal — they take the same fields. */
export const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  dueDate: z.string().optional(),
  estimatedHrs: z.number().positive().optional().nullable(),
  /* '' means unassigned; the modals turn it into null before sending. */
  assigneeId: z.string().optional(),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;
