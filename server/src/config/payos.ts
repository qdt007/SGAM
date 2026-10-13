import { PayOS, type CreatePaymentLinkResponse, type Webhook, type WebhookData } from '@payos/node';
import { env } from '../utils/env';

/**
 * payOS.
 *
 * Deliberately thin, and deliberately not another `config/vnpay.ts`. VNPay's signing has to be
 * reproduced by hand down to which characters get escaped, and every deviation comes back as
 * "Sai chữ ký" with nothing to point at. payOS publishes an SDK that builds and checks its own
 * signatures, so the dependency buys away the entire class of bug — there is no HMAC in here on
 * purpose. What is left is configuration and the three calls the app actually makes.
 */

/** payOS truncates the transfer description, and unlinked bank accounts get only 9 characters. */
export const MAX_DESCRIPTION = 9;

let client: PayOS | null = null;

export function payosConfigured(): boolean {
  return !!(env('PAYOS_CLIENT_ID') && env('PAYOS_API_KEY') && env('PAYOS_CHECKSUM_KEY'));
}

/** Which of the three credentials are missing, for /health to name them rather than just fail. */
export function payosStatus(): { configured: boolean; missing: string[] } {
  const missing = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'].filter((k) => !env(k));
  return { configured: missing.length === 0, missing };
}

/**
 * Built on first use, not at import time: the module graph is loaded before dotenv has run, so a
 * client constructed up here would capture an empty configuration and never recover.
 */
function payos(): PayOS {
  if (!payosConfigured()) {
    throw Object.assign(new Error('payOS is not configured'), { status: 503 });
  }
  client ??= new PayOS({
    clientId: env('PAYOS_CLIENT_ID')!,
    apiKey: env('PAYOS_API_KEY')!,
    checksumKey: env('PAYOS_CHECKSUM_KEY')!,
  });
  return client;
}

/** Drops the memoised client so a later call picks up changed credentials. Tests only. */
export function resetPayosClient(): void {
  client = null;
}

export interface PaymentLinkInput {
  /** Unique per merchant, and an integer — payOS rejects a string or a repeat. */
  orderCode: number;
  amount: number;
  /** Becomes the bank transfer content, so keep it within MAX_DESCRIPTION. */
  description: string;
  returnUrl: string;
  cancelUrl: string;
  minutesValid?: number;
}

export async function createPaymentLink(input: PaymentLinkInput): Promise<CreatePaymentLinkResponse> {
  return payos().paymentRequests.create({
    orderCode: input.orderCode,
    amount: input.amount,
    description: input.description.slice(0, MAX_DESCRIPTION),
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
    // Seconds, not milliseconds. An expired link is what stops an abandoned order being paid
    // weeks later against a price that has since changed.
    expiredAt: Math.floor(Date.now() / 1000) + (input.minutesValid ?? 30) * 60,
  });
}

/** Resolves to the payload only when the signature checks out; throws otherwise. */
export async function verifyWebhook(body: Webhook): Promise<WebhookData> {
  return payos().webhooks.verify(body);
}

/**
 * Registers the webhook URL with payOS. payOS immediately posts a sample transaction to it and
 * refuses the registration unless that call answers 2xx, so the server must already be deployed
 * and reachable when this runs.
 */
export async function registerWebhook(url: string) {
  return payos().webhooks.confirm(url);
}

export type { WebhookData };
