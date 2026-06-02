import { PrismaClient } from '@prisma/client';
export function extractMentions(text: string): string[] {
  const regex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.matchAll(regex);
  return [...new Set([...matches].map((m) => m[1]))];
}
export async function resolveUserIds(handles: string[], prisma: PrismaClient): Promise<string[]> {
  if (handles.length === 0) return [];
  const users = await prisma.user.findMany({ where: { username: { in: handles }, isActive: true }, select: { id: true } });
  return users.map((u) => u.id);
}
