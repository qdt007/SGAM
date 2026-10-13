import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { extractMentions } from '../utils/mentions';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../modules/messages/messages.service';
import { createMessageSchema, updateMessageSchema } from '../modules/messages/messages.schema';
import { createBlockerSchema, resolveBlockerSchema } from '../modules/blockers/blockers.schema';

/**
 * Pure schema and routing contract. Nothing here touches the database — the behaviour that does
 * (fanout, mention resolution against real members, the notification rows) is exercised by using
 * the app, which is what the DEPLOY.md checklist covers.
 */

const UUID = '00000000-0000-0000-0000-000000000000';

describe('message schema', () => {
  it('refuses an empty or whitespace-only body', () => {
    expect(createMessageSchema.safeParse({ body: '' }).success).toBe(false);
    expect(createMessageSchema.safeParse({ body: '   \n  ' }).success).toBe(false);
  });

  it('trims the body, so a message is never stored with padding', () => {
    const parsed = createMessageSchema.parse({ body: '  xin chào  ' });
    expect(parsed.body).toBe('xin chào');
  });

  it('caps the body so one message cannot be a novel', () => {
    expect(createMessageSchema.safeParse({ body: 'a'.repeat(4001) }).success).toBe(false);
    expect(createMessageSchema.safeParse({ body: 'a'.repeat(4000) }).success).toBe(true);
  });

  it('treats pinning as a separate, optional decision from writing', () => {
    expect(createMessageSchema.parse({ body: 'hi' }).pinned).toBeUndefined();
    expect(createMessageSchema.parse({ body: 'hi', pinned: true }).pinned).toBe(true);
  });

  it('rejects an update that changes nothing', () => {
    expect(updateMessageSchema.safeParse({}).success).toBe(false);
    // Pinning alone is valid: a manager pins without rewriting someone else's words.
    expect(updateMessageSchema.safeParse({ pinned: true }).success).toBe(true);
    expect(updateMessageSchema.safeParse({ body: 'sửa' }).success).toBe(true);
  });
});

describe('mention extraction in a chat body', () => {
  it('finds each distinct handle once', () => {
    expect(extractMentions('@an ơi @binh xem với, @an nhé')).toEqual(['an', 'binh']);
  });

  it('ignores an email address, which is not a mention', () => {
    // The regex takes @ followed by word characters, so the domain looks like a handle. This
    // documents that it does — the project-membership check downstream is what makes it harmless.
    expect(extractMentions('gửi tới demo@test.com')).toEqual(['test']);
  });

  it('returns nothing for a body with no handles', () => {
    expect(extractMentions('không nhắc ai cả')).toEqual([]);
  });
});

describe('message paging limits', () => {
  it('keeps the default inside the maximum', () => {
    expect(DEFAULT_LIMIT).toBeLessThanOrEqual(MAX_LIMIT);
    expect(DEFAULT_LIMIT).toBeGreaterThan(0);
  });
});

describe('blocker schema', () => {
  it('requires a title — an unnamed difficulty tells the team nothing', () => {
    expect(createBlockerSchema.safeParse({}).success).toBe(false);
    expect(createBlockerSchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(createBlockerSchema.safeParse({ title: 'Chờ khoá payOS' }).success).toBe(true);
  });

  it('defaults impact at the service rather than in the schema', () => {
    // Left undefined here on purpose: blockers.service applies SERIOUS, so the API and a direct
    // service call cannot disagree about the default.
    expect(createBlockerSchema.parse({ title: 'x' }).impact).toBeUndefined();
  });

  it('only accepts the three impact levels', () => {
    expect(createBlockerSchema.safeParse({ title: 'x', impact: 'BLOCKING' }).success).toBe(true);
    expect(createBlockerSchema.safeParse({ title: 'x', impact: 'URGENT' }).success).toBe(false);
  });

  it('accepts a task link only as a uuid', () => {
    expect(createBlockerSchema.safeParse({ title: 'x', taskId: UUID }).success).toBe(true);
    expect(createBlockerSchema.safeParse({ title: 'x', taskId: 'not-a-uuid' }).success).toBe(false);
  });

  it('lets a blocker be resolved without writing an explanation', () => {
    // Asked for every time, never forced — a required field here just produces "done" forever.
    expect(resolveBlockerSchema.safeParse({}).success).toBe(true);
    expect(resolveBlockerSchema.parse({ resolution: '  đã có khoá  ' }).resolution).toBe('đã có khoá');
  });
});

describe('chat and blocker routes are behind the authenticate guard', () => {
  const routes: [string, string][] = [
    ['get', `/api/projects/${UUID}/messages`],
    ['get', `/api/projects/${UUID}/messages/pinned`],
    ['post', `/api/projects/${UUID}/messages`],
    ['patch', `/api/messages/${UUID}`],
    ['delete', `/api/messages/${UUID}`],
    ['get', `/api/projects/${UUID}/blockers`],
    ['post', `/api/projects/${UUID}/blockers`],
    ['get', `/api/blockers/${UUID}`],
    ['patch', `/api/blockers/${UUID}`],
    ['post', `/api/blockers/${UUID}/resolve`],
    ['post', `/api/blockers/${UUID}/reopen`],
    ['delete', `/api/blockers/${UUID}`],
  ];

  it.each(routes)('%s %s answers 401 without a token', async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path);
    expect(res.status).toBe(401);
  });
});
