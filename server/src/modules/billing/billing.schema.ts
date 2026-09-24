import { z } from 'zod';
import { BillingCycle } from '@prisma/client';

export const checkoutSchema = z.object({
  cycle: z.nativeEnum(BillingCycle),
});

export const confirmSchema = z.object({
  providerRef: z.string().min(1),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ConfirmInput = z.infer<typeof confirmSchema>;
