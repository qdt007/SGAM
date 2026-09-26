/**
 * Accounts for the real EXE101 group, plus one project they all share.
 *
 * Kept separate from `seed.ts` on purpose: that one owns three demo projects and deletes them by
 * name every run, and these are real people who should not disappear when the demo data is
 * refreshed. Nothing here overlaps with what `seed.ts` touches.
 *
 * Re-runnable. Existing accounts are matched by email and only have their display name and
 * membership corrected — passwords already changed by their owner are left alone.
 *
 * Run: npm run seed:team
 */
import 'dotenv/config';
import crypto from 'crypto';
import { PrismaClient, ProjectRole } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';
import { saveFile } from '../src/config/storage';

const prisma = new PrismaClient();

/**
 * These are real people with accounts on a live deployment, and this repository is public — a
 * literal password here would be readable by anyone. Set TEAM_SEED_PASSWORD to choose one,
 * otherwise a random one is generated and printed once at the end of this run.
 */
const PASSWORD =
  process.env.TEAM_SEED_PASSWORD ?? `Sgam${crypto.randomBytes(4).toString('hex').toUpperCase()}!`;
const PROJECT_NAME = 'Nhóm EXE101 — SGAM';

interface Member {
  email: string;
  username: string;
  displayName: string;
  role: ProjectRole;
  /** Wikipedia article whose lead image becomes the avatar. */
  portrait: string;
}

/** Gia Hân leads the group, so she owns the project; everyone else can create and edit. */
const TEAM: Member[] = [
  { email: 'giahan@sgam.com', username: 'giahan', displayName: 'Gia Hân', role: 'OWNER', portrait: 'Scarlett_Johansson' },
  { email: 'hoaingoc@sgam.com', username: 'hoaingoc', displayName: 'Hoài Ngọc', role: 'MEMBER', portrait: 'Elizabeth_Olsen' },
  { email: 'minhquan@sgam.com', username: 'minhquan', displayName: 'Minh Quân', role: 'MEMBER', portrait: 'Robert_Downey_Jr.' },
  { email: 'trongquy@sgam.com', username: 'trongquy', displayName: 'Phan Trong Quy', role: 'MEMBER', portrait: 'Chris_Hemsworth' },
  { email: 'truongvu@sgam.com', username: 'truongvu', displayName: 'Truong Vu', role: 'MEMBER', portrait: 'Chris_Evans_(actor)' },
  { email: 'quynh@sgam.com', username: 'quynh', displayName: 'Quỳnh Quỳnh', role: 'MEMBER', portrait: 'Brie_Larson' },
];

/**
 * Pulls the lead image off a Wikipedia article and stores it through the app's own avatar
 * pipeline, so the picture ends up in Cloudinary rather than hot-linked. Hot-linking would put
 * a network round trip between the app and every avatar it draws.
 *
 * These are Wikimedia Commons portraits of the actors, which carry free licences — the official
 * Marvel stills of the characters do not, and are not ours to redistribute.
 */
async function fetchPortrait(article: string): Promise<string | null> {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${article}`, {
      headers: { 'User-Agent': 'SGAM-EXE101/1.0 (student project seed)' },
    });
    if (!res.ok) return null;
    const summary = (await res.json()) as { thumbnail?: { source?: string } };
    const url = summary.thumbnail?.source;
    if (!url) return null;

    const img = await fetch(url, { headers: { 'User-Agent': 'SGAM-EXE101/1.0 (student project seed)' } });
    if (!img.ok) return null;
    const mimetype = img.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
    const buffer = Buffer.from(await img.arrayBuffer());

    const stored = await saveFile({ originalname: `${article}.jpg`, mimetype, buffer });
    return stored.url;
  } catch {
    // An avatar is decoration; a flaky network must not stop the team being created.
    return null;
  }
}

/** The demo account is the one signed in during development; keep it able to manage the project. */
const DEMO_EMAIL = 'demo@test.com';

async function main() {
  console.log('Seeding the EXE101 team...');
  const passwordHash = await hashPassword(PASSWORD);

  const users = await Promise.all(
    TEAM.map(async (m) => {
      const avatarUrl = await fetchPortrait(m.portrait);
      const user = await prisma.user.upsert({
        where: { email: m.email },
        // Only the name and picture are refreshed on an existing account — never the password.
        update: { displayName: m.displayName, ...(avatarUrl ? { avatarUrl } : {}) },
        create: { email: m.email, username: m.username, displayName: m.displayName, passwordHash, avatarUrl },
        select: { id: true, email: true, displayName: true, avatarUrl: true },
      });
      return { ...user, role: m.role };
    }),
  );

  const project =
    (await prisma.project.findFirst({ where: { name: PROJECT_NAME }, select: { id: true } })) ??
    (await prisma.project.create({
      data: {
        name: PROJECT_NAME,
        description: 'Không gian làm việc chung của nhóm EXE101.',
        status: 'ACTIVE',
        priority: 'HIGH',
        coverColor: '#C2410C',
      },
      select: { id: true },
    }));

  for (const u of users) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: u.id } },
      update: { role: u.role },
      create: { projectId: project.id, userId: u.id, role: u.role },
    });
  }

  const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
  if (demo) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: demo.id } },
      update: { role: 'OWNER' },
      create: { projectId: project.id, userId: demo.id, role: 'OWNER' },
    });
  }

  console.log(`
  Done.

  Project: ${PROJECT_NAME}
  Password for accounts created by this run: ${PASSWORD}
  (Existing accounts keep whatever password they already had.)

${users.map((u) => `    ${u.role.padEnd(7)} ${u.email.padEnd(22)} ${u.displayName}`).join('\n')}
${demo ? `    OWNER   ${DEMO_EMAIL.padEnd(22)} (tài khoản demo của bạn)` : ''}

  Everyone should change their password in Settings after signing in.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
