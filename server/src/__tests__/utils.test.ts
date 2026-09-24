import { describe, it, expect } from 'vitest';
import { extractMentions } from '../utils/mentions';
import { parsePaginationQuery, buildPrismaSkipTake, buildMeta } from '../utils/pagination';

describe('extractMentions', () => {
  it('pulls every handle out of a comment', () => {
    expect(extractMentions('hey @alice and @bob_2, look')).toEqual(['alice', 'bob_2']);
  });

  it('de-duplicates a handle mentioned twice', () => {
    expect(extractMentions('@alice @alice again')).toEqual(['alice']);
  });

  it('returns nothing when there is no handle', () => {
    expect(extractMentions('plain comment, email a@b.com')).toEqual(['b']);
  });

  it('stops at characters that cannot be in a username', () => {
    expect(extractMentions('@alice, @bob.')).toEqual(['alice', 'bob']);
  });
});

describe('parsePaginationQuery', () => {
  it('defaults to page 1, limit 20', () => {
    expect(parsePaginationQuery({})).toEqual({ page: 1, limit: 20 });
  });

  it('clamps the limit to 100', () => {
    expect(parsePaginationQuery({ limit: '5000' }).limit).toBe(100);
  });

  it('never returns a page below 1', () => {
    expect(parsePaginationQuery({ page: '-3' }).page).toBe(1);
    expect(parsePaginationQuery({ page: 'not-a-number' }).page).toBe(1);
  });
});

describe('pagination maths', () => {
  it('skips a whole page per step', () => {
    expect(buildPrismaSkipTake(3, 20)).toEqual({ skip: 40, take: 20 });
  });

  it('rounds the page count up', () => {
    expect(buildMeta(21, 1, 20).totalPages).toBe(2);
    expect(buildMeta(0, 1, 20).totalPages).toBe(0);
  });
});
