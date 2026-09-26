import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

/**
 * Contract tests that never touch the database: auth rejection, validation and
 * routing. Anything that would read or write real rows belongs elsewhere.
 */
describe('health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('404s an unknown route in the API shape', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe('authentication guard', () => {
  const protectedRoutes: [string, string][] = [
    ['get', '/api/projects'],
    ['get', '/api/notifications'],
    ['get', '/api/users/search'],
    ['get', '/api/time/running'],
    ['get', '/api/tasks/00000000-0000-0000-0000-000000000000'],
    ['get', '/api/tasks/00000000-0000-0000-0000-000000000000/comments'],
    ['get', '/api/tasks/00000000-0000-0000-0000-000000000000/files'],
    ['get', '/api/projects/00000000-0000-0000-0000-000000000000/reports/summary'],
  ];

  it.each(protectedRoutes)('%s %s requires a token', async (method, path) => {
    const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/projects').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

describe('validation', () => {
  it('rejects a register payload with a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'someone@example.com',
      username: 'someone',
      displayName: 'Someone',
      password: 'short',
    });
    expect(res.status).toBe(422);
    expect(res.body.errors?.length).toBeGreaterThan(0);
  });

  it('rejects a login payload that is not an email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nope', password: 'whatever' });
    expect(res.status).toBe(422);
  });
});

/** Routes added when the half-finished features were completed. */
describe('avatar, tags and session endpoints', () => {
  const NIL = '00000000-0000-0000-0000-000000000000';
  const newRoutes: [string, string][] = [
    ['post', '/api/users/me/avatar'],
    ['delete', '/api/users/me/avatar'],
    ['post', '/api/auth/logout-all'],
    ['post', `/api/projects/${NIL}/tags`],
    ['delete', `/api/projects/${NIL}/tags/${NIL}`],
    ['put', `/api/tasks/${NIL}/tags`],
    ['delete', '/api/notifications/clear-all'],
  ];

  it.each(newRoutes)('%s %s requires a token', async (method, path) => {
    const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  // Ordering regression: /clear-all must stay above /:id or it is parsed as a notification id.
  it('routes DELETE /notifications/clear-all before the :id route', async () => {
    const res = await request(app).delete('/api/notifications/clear-all');
    expect(res.status).toBe(401);
  });
});

describe('two-factor and Google sign-in', () => {
  const guarded: [string, string][] = [
    ['get', '/api/auth/2fa'],
    ['post', '/api/auth/2fa/setup'],
    ['post', '/api/auth/2fa/enable'],
    ['post', '/api/auth/2fa/disable'],
  ];

  it.each(guarded)('%s %s requires a token', async (method, path) => {
    const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('rejects a 2fa verify payload with no challenge', async () => {
    const res = await request(app).post('/api/auth/2fa/verify').send({ code: '123456' });
    expect(res.status).toBe(422);
  });

  it('sends /auth/google to Google with a signed state', async () => {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.location);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('state')?.split('.')).toHaveLength(3);
  });

  it('bounces a callback with a forged state back to the client, not into the app', async () => {
    const res = await request(app).get('/api/auth/google/callback?code=x&state=forged');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('#error=');
  });
});

describe('token separation', () => {
  it('will not let a 2FA challenge stand in for an access token', async () => {
    const { signTwoFactorChallenge } = await import('../utils/jwt');
    const challenge = signTwoFactorChallenge('00000000-0000-0000-0000-000000000000');
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${challenge}`);
    expect(res.status).toBe(401);
  });
});

describe('VNPay callbacks', () => {
  // Unauthenticated by necessity: VNPay calls server-to-server with no session.
  it('accepts the IPN without a token and refuses it without a valid signature', async () => {
    const res = await request(app).get('/api/billing/vnpay/ipn?vnp_TxnRef=nope&vnp_SecureHash=forged');
    expect(res.status).toBe(200);
    // 97 when signing is configured, 99 when it is not — never a silent success.
    expect(['97', '99']).toContain(res.body.RspCode);
  });

  it('sends the browser back to the client from the return URL rather than rendering', async () => {
    const res = await request(app).get('/api/billing/vnpay/return?vnp_TxnRef=nope&vnp_SecureHash=forged');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=invalid');
  });

  it('still requires a token to start a checkout', async () => {
    const res = await request(app).post('/api/billing/checkout').send({ cycle: 'MONTHLY' });
    expect(res.status).toBe(401);
  });
});
