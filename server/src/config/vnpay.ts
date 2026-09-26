import crypto from 'crypto';

/**
 * VNPay 2.1.0. Everything here exists to reproduce one thing exactly: the string VNPay signs.
 *
 * Their algorithm is not "URL-encode the query" — it is: encode each key, sort by the *encoded*
 * key, encode each value with %20 rewritten to `+`, then join with & and = and do not encode
 * again. `URLSearchParams` produces a subtly different string (it escapes `!'()*`), and any
 * difference at all comes back as "Sai chữ ký". So the sample's steps are followed literally.
 */

export const VNPAY_SANDBOX_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

export function vnpayConfigured(): boolean {
  return !!(process.env.VNPAY_TMN_CODE && process.env.VNPAY_HASH_SECRET);
}

function payUrl(): string {
  return process.env.VNPAY_PAY_URL || VNPAY_SANDBOX_URL;
}

/** Encoded, sorted, joined — the exact string VNPay hashes. */
function signData(params: Record<string, string>): string {
  const encodedKeys = Object.keys(params).map(encodeURIComponent).sort();
  return encodedKeys
    .map((k) => `${k}=${encodeURIComponent(params[decodeURIComponent(k)]).replace(/%20/g, '+')}`)
    .join('&');
}

function sign(data: string): string {
  return crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET!).update(Buffer.from(data, 'utf-8')).digest('hex');
}

/** yyyyMMddHHmmss in GMT+7, which is the only timezone VNPay accepts. */
function vnpDate(d: Date): string {
  const vn = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${vn.getFullYear()}${p(vn.getMonth() + 1)}${p(vn.getDate())}${p(vn.getHours())}${p(vn.getMinutes())}${p(vn.getSeconds())}`;
}

export interface PaymentUrlInput {
  txnRef: string;
  /** Plain dong. VNPay wants it times 100. */
  amount: number;
  orderInfo: string;
  ipAddr: string;
  /** How long the customer has before VNPay rejects the order. */
  minutesValid?: number;
}

export function buildPaymentUrl(input: PaymentUrlInput): string {
  const now = new Date();
  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
    vnp_Amount: String(input.amount * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:5000/api/billing/vnpay/return',
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: vnpDate(now),
    vnp_ExpireDate: vnpDate(new Date(now.getTime() + (input.minutesValid ?? 15) * 60_000)),
  };

  const data = signData(params);
  return `${payUrl()}?${data}&vnp_SecureHash=${sign(data)}`;
}

/**
 * True when the callback really came from VNPay. Compared in constant time so the check cannot
 * be probed a character at a time.
 */
export function verifyCallback(query: Record<string, string>): boolean {
  const received = query.vnp_SecureHash;
  if (!received) return false;

  const rest: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType') rest[k] = v;
  }

  const expected = sign(signData(rest));
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(received.toLowerCase(), 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
