import { ParsedQs } from 'qs';
export interface PaginationQuery { page: number; limit: number; }
export interface PaginationMeta { total: number; page: number; limit: number; totalPages: number; }
export function parsePaginationQuery(query: ParsedQs): PaginationQuery {
  const page = Math.max(1, parseInt((query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '20', 10)));
  return { page, limit };
}
export function buildPrismaSkipTake(page: number, limit: number) { return { skip: (page - 1) * limit, take: limit }; }
export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
