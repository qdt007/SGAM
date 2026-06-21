import { z } from 'zod';
import { ProjectStatus, Priority, ProjectRole } from '@prisma/client';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(ProjectRole).optional(),
});

export const updateMemberSchema = z.object({
  role: z.nativeEnum(ProjectRole),
});

export const createColumnSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateColumnSchema = createColumnSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
