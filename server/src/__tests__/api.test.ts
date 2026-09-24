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
