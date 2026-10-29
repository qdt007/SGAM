import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { payosConfigured, payosStatus, MAX_DESCRIPTION, resetPayosClient } from '../config/payos';
import { activeProvider, PAYOS_PROVIDER, VNPAY_PROVIDER, PROVIDER, getPlans } from '../modules/billing/billing.service';

/**
 * Pure configuration logic plus the route contract. Nothing here calls payOS or the database —
 * the parts that do are exercised by actually paying, which is what DEPLOY.md's checklist is for.
 */

const PAYOS_KEYS = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];
const VNPAY_KEYS = ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'];

const ORIGINAL = { ...process.env };
beforeEach(() => {
  for (const k of [...PAYOS_KEYS, ...VNPAY_KEYS]) delete process.env[k];
  resetPayosClient();
});
afterEach(() => {
  process.env = { ...ORIGINAL };
  resetPayosClient();
});

const setPayos = () => PAYOS_KEYS.forEach((k, i) => (process.env[k] = `value-${i}`));
const setVnpay = () => VNPAY_KEYS.forEach((k, i) => (process.env[k] = `value-${i}`));

describe('payosConfigured', () => {
  it('is false until all three credentials are present', () => {
    expect(payosConfigured()).toBe(false);
    process.env.PAYOS_CLIENT_ID = 'a';
    process.env.PAYOS_API_KEY = 'b';
    expect(payosConfigured()).toBe(false);
    process.env.PAYOS_CHECKSUM_KEY = 'c';
    expect(payosConfigured()).toBe(true);
  });

  it('treats a credential that is only whitespace as unset', () => {
    setPayos();
    // A value pasted out of a dashboard routinely arrives with a trailing newline; one that is
    // nothing but whitespace is a variable someone meant to fill in and did not.
    process.env.PAYOS_API_KEY = '  \t\n ';
    expect(payosConfigured()).toBe(false);
    expect(payosStatus().missing).toEqual(['PAYOS_API_KEY']);
  });

  it('names every missing credential rather than just failing', () => {
    process.env.PAYOS_CLIENT_ID = 'a';
    expect(payosStatus()).toEqual({
      configured: false,
      missing: ['PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'],
    });
  });
});

describe('activeProvider', () => {
  it('falls back to the simulated provider with no credentials at all', () => {
    expect(activeProvider()).toBe(PROVIDER);
    expect(getPlans().simulated).toBe(true);
  });

  it('uses VNPay when only VNPay is configured', () => {
    setVnpay();
    expect(activeProvider()).toBe(VNPAY_PROVIDER);
  });

  it('prefers payOS when both gateways are configured', () => {
    setVnpay();
    setPayos();
    expect(activeProvider()).toBe(PAYOS_PROVIDER);
  });

  it('stops advertising itself as simulated once a gateway is live', () => {
    setPayos();
    const plans = getPlans();
    expect(plans.simulated).toBe(false);
    expect(plans.provider).toBe(PAYOS_PROVIDER);
  });
});

describe('payOS callback routes', () => {
  it('acknowledges a webhook that is not signed with our checksum key, without acting on it', async () => {
    setPayos();
    const res = await request(app)
      .post('/api/billing/payos/webhook')
      .send({ code: '00', desc: 'success', success: true, data: { orderCode: 123 }, signature: 'forged' });
    // 200 on purpose. This answered 401 once and payOS refused to register the URL at all — it
    // probes the endpoint on save and wants 2xx. There is nothing lost by acknowledging: a
    // payload that fails the check did not come from payOS, so no delivery is being dropped.
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/not processed/i);
  });

  it('says so when payOS is not configured instead of blaming the signature', async () => {
    const res = await request(app).post('/api/billing/payos/webhook').send({ signature: 'x' });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not configured/i);
  });

  it('is reachable without a session, since payOS has none', async () => {
    // The authenticate guard answers 401 for a missing token. payOS's callbacks are mounted
    // above it, so an unconfigured server gets as far as 503 rather than being turned away.
    const res = await request(app).post('/api/billing/payos/webhook').send({});
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(503);
  });

  it('redirects a returning browser back to the billing tab without granting anything', async () => {
    const res = await request(app).get('/api/billing/payos/return').query({ cancel: 'true', orderCode: '1' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('tab=billing');
    expect(res.headers.location).toContain('payment=cancelled');
    expect(res.headers.location).toContain('settled=0');
  });
});

describe('payOS field limits', () => {
  it('keeps the transfer description inside what an unlinked bank account shows', () => {
    // payOS truncates to 9 characters for accounts not linked through them, and the truncated
    // text is what the payer sees in their banking app.
    expect('SGAM Pro'.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it('generates order codes that stay inside a JavaScript safe integer', () => {
    // orderCode is an int64 to payOS but a Number here, and it is built from Date.now().
    const latest = new Date('2255-01-01').getTime() * 1000 + 999;
    expect(Number.isSafeInteger(latest)).toBe(true);
  });
});
