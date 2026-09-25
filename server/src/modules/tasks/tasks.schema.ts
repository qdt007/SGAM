import { z } from 'zod';
import { TaskStatus, Priority } from '@prisma/client';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  columnId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedHrs: z.number().positive().optional().nullable(),
  order: z.number().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const moveTaskSchema = z.object({
  columnId: z.string().uuid(),
  order: z.number(),
});

export const addDependencySchema = z.object({
  blockingTaskId: z.string().uuid(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type AddDependencyInput = z.infer<typeof addDependencySchema>;

export const setTaskTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).max(20),
});
export type SetTaskTagsInput = z.infer<typeof setTaskTagsSchema>;
