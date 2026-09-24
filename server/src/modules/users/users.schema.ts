import { z } from 'zod';

export const updateMeSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscore').optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100)
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

export const updateNotificationPrefsSchema = z.object({
  taskAssigned: z.boolean().optional(),
  taskUpdated: z.boolean().optional(),
  taskCommented: z.boolean().optional(),
  mentioned: z.boolean().optional(),
  deadlineApproaching: z.boolean().optional(),
  projectInvite: z.boolean().optional(),
  fileUploaded: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
