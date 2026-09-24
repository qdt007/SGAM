import { ParsedQs } from 'qs';
export interface PaginationQuery { page: number; limit: number; }
export interface PaginationMeta { total: number; page: number; limit: number; totalPages: number; }
/** A non-numeric ?page= must fall back to the default, not poison skip/take with NaN. */
function toInt(value: unknown, fallback: number): number {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parsePaginationQuery(query: ParsedQs): PaginationQuery {
  const page = Math.max(1, toInt(query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(query.limit, 20)));
  return { page, limit };
}
export function buildPrismaSkipTake(page: number, limit: number) { return { skip: (page - 1) * limit, take: limit }; }
export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
