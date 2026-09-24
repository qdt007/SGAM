/**
 * Demo data for the test account.
 *
 * Re-runnable: it deletes only the three projects it owns (by exact name) and the
 * notifications of the accounts it creates, so anything you made by hand survives.
 *
 * Run: npm run seed
 */
// First import: storage.ts reads STORAGE_TYPE and the Cloudinary keys at module load.
import 'dotenv/config';
import { PrismaClient, ProjectRole, GlobalRole, TaskStatus, Priority, NotificationType, BillingCycle } from '@prisma/client';
import { periodEndFrom, priceFor } from '../src/constants/plans';
import { saveFile, removeFile, STORAGE_TYPE } from '../src/config/storage';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

const PASSWORD = 'Demo1234!';
const SEED_PROJECTS = ['SGAM Platform v2', 'Customer Onboarding Revamp', 'Growth Sprint Q3'];

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number, hour = 10) => {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const daysAhead = (n: number, hour = 17) => daysAgo(-n, hour);

/* ─── People ─────────────────────────────────────────────── */

interface Person {
  email: string;
  username: string;
  displayName: string;
  globalRole?: GlobalRole;
  password?: string;
}

const PEOPLE: Person[] = [
  /* Presentation accounts — one of each global role, fixed credentials. */
  { email: 'admin@sgam.com', username: 'sgamadmin', displayName: 'Mai Bá Anh Quân (Admin)', globalRole: GlobalRole.ADMIN, password: 'Admin1234!' },
  { email: 'user@sgam.com',  username: 'sgamuser',  displayName: 'Nguyễn Văn User',         globalRole: GlobalRole.USER,  password: 'User1234!' },

  /* The working team, one per project role. */
  { email: 'demo@test.com',  username: 'demouser', displayName: 'Demo User' },
  { email: 'linh@test.com',  username: 'linh',     displayName: 'Nguyễn Thùy Linh' },
  { email: 'minh@test.com',  username: 'minhtq',   displayName: 'Trần Quang Minh' },
  { email: 'an@test.com',    username: 'hoaian',   displayName: 'Lê Hoài An' },
  { email: 'khanh@test.com', username: 'khanhpb',  displayName: 'Phạm Bảo Khánh' },
];

async function upsertPeople() {
  const users: Record<string, string> = {};
  for (const p of PEOPLE) {
    const passwordHash = await hashPassword(p.password ?? PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: p.email },
      // Demo credentials are reset on every seed so they are always known.
      update: {
        displayName: p.displayName,
        username: p.username,
        globalRole: p.globalRole ?? GlobalRole.USER,
        passwordHash,
        isActive: true,
      },
      create: {
        email: p.email,
        username: p.username,
        displayName: p.displayName,
        globalRole: p.globalRole ?? GlobalRole.USER,
        passwordHash,
      },
      select: { id: true, username: true },
    });
    users[user.username] = user.id;
  }
  return users;
}

/**
 * Plans for the demo accounts. The Pro ones keep reports and the timeline
 * working during a presentation; the Free one is there to show the limits.
 */
async function seedSubscriptions(u: Record<string, string>) {
  const now = new Date();

  const pro = async (userId: string, cycle: BillingCycle) => {
    const sub = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: 'PRO',
        status: 'ACTIVE',
        cycle,
        startedAt: daysAgo(30),
        currentPeriodEnd: periodEndFrom(now, cycle),
      },
      update: {
        tier: 'PRO',
        status: 'ACTIVE',
        cycle,
        startedAt: daysAgo(30),
        currentPeriodEnd: periodEndFrom(now, cycle),
        cancelAtPeriodEnd: false,
      },
      select: { id: true },
    });
    await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        userId,
        amount: priceFor(cycle),
        cycle,
        status: 'PAID',
        provider: 'MOCK',
        providerRef: `MOCK-seed-${userId.slice(0, 8)}-${cycle}`,
        paidAt: daysAgo(30),
        createdAt: daysAgo(30),
      },
    });
  };

  const free = (userId: string) =>
    prisma.subscription.upsert({
      where: { userId },
      create: { userId },
      update: { tier: 'FREE', status: 'ACTIVE', cycle: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    });

  await pro(u.sgamadmin, 'YEARLY');
  await pro(u.demouser, 'MONTHLY');
  await free(u.sgamuser);
  await Promise.all([u.linh, u.minhtq, u.hoaian, u.khanhpb].map(free));
}

/* ─── Attachments that actually exist in whatever storage is configured ──── */

/**
 * Goes through the same backend the API uses, so seeding a hosted database uploads to
 * Cloudinary rather than writing a file only this laptop can serve. The previous run's blobs
 * are deleted by cleanup() above, which reads the keys off the rows instead of guessing them.
 */
async function writeAttachment(name: string, body: string, mimeType: string) {
  const buffer = Buffer.from(body, 'utf-8');
  const stored = await saveFile({ originalname: name, mimetype: mimeType, buffer });
  return { ...stored, size: buffer.length };
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <rect width="120" height="120" rx="28" fill="#0066cc"/>
  <circle cx="60" cy="44" r="14" fill="#ffffff"/>
  <path d="M28 100c0-17.7 14.3-32 32-32s32 14.3 32 32z" fill="#ffffff"/>
</svg>`;

const RESEARCH_MD = `# Phỏng vấn người dùng — vòng 2

**Ngày:** tuần 3 · **Số người:** 8 sinh viên, 2 giảng viên

## Điều lặp lại ở nhiều người
1. Không biết task nào đang chờ mình — phải mở từng project để xem.
2. Kéo thả trên Kanban ổn, nhưng không có chỗ trao đổi trong từng task.
3. Muốn biết ai đang làm gì mà không phải hỏi trong nhóm chat.

## Kết luận
Ưu tiên: thông báo realtime > bình luận có @mention > báo cáo workload.
`;

const RETRO_CSV = `tuần,điểm hài lòng,task hoàn thành,ghi chú
1,3.2,4,"Setup môi trường mất nhiều thời gian hơn dự kiến"
2,3.8,9,"Kanban chạy được, nhóm bắt đầu dùng thật"
3,4.1,11,"Có thông báo nên đỡ phải hỏi nhau"
4,4.5,14,"Bình luận + mention giúp giảm họp"
`;

/* ─── Main ───────────────────────────────────────────────── */

async function clean(userIds: string[]) {
  const projects = await prisma.project.findMany({
    where: { name: { in: SEED_PROJECTS } },
    select: { id: true },
  });
  // Blobs are not rows and do not cascade, so note them before the File rows disappear.
  const blobs = await prisma.file.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: { storageKey: true, mimeType: true },
  });
  // Tasks, comments, files, time logs and members all cascade from the project.
  await prisma.project.deleteMany({ where: { id: { in: projects.map((p) => p.id) } } });
  await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
  await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });

  for (const b of blobs) await removeFile(b.storageKey, b.mimeType);
}

async function main() {
  console.log('Seeding demo data...');
  const u = await upsertPeople();
  await clean(Object.values(u));
  await seedSubscriptions(u);

  /* ── Tags are global; reuse them across projects ── */
  const tagNames: [string, string][] = [
    ['frontend', '#0066cc'], ['backend', '#8b5cf6'], ['design', '#ec4899'],
    ['bug', '#ef4444'], ['research', '#10b981'], ['docs', '#f59e0b'],
  ];
  const tags: Record<string, string> = {};
  for (const [name, color] of tagNames) {
    const tag = await prisma.tag.upsert({ where: { name }, update: { color }, create: { name, color } });
    tags[name] = tag.id;
  }

  /* ══ Project 1 — the rich one ═══════════════════════════ */

  const platform = await prisma.project.create({
    data: {
      name: SEED_PROJECTS[0],
      description: 'Nền tảng quản lý dự án cho môn EXE101 — bản v2 tập trung vào cộng tác realtime.',
      status: 'ACTIVE',
      priority: 'HIGH',
      // Kickoff is the day the first tasks appear, so the burndown starts at full scope.
      startDate: daysAgo(44),
      endDate: daysAhead(15),
      coverColor: '#0066cc',
      createdAt: daysAgo(44),
      members: {
        create: [
          { userId: u.demouser, role: ProjectRole.OWNER,   joinedAt: daysAgo(45) },
          { userId: u.linh,     role: ProjectRole.MANAGER, joinedAt: daysAgo(44) },
          { userId: u.minhtq,   role: ProjectRole.MEMBER,  joinedAt: daysAgo(43) },
          { userId: u.hoaian,   role: ProjectRole.MEMBER,  joinedAt: daysAgo(40) },
          { userId: u.khanhpb,  role: ProjectRole.VIEWER,  joinedAt: daysAgo(20) },
          { userId: u.sgamadmin, role: ProjectRole.OWNER,  joinedAt: daysAgo(44) },
          { userId: u.sgamuser,  role: ProjectRole.MEMBER, joinedAt: daysAgo(30) },
        ],
      },
      columns: {
        create: [
          { name: 'Backlog',     order: 0, color: '#8a8a8e' },
          { name: 'To Do',       order: 1, color: '#0066cc' },
          { name: 'In Progress', order: 2, color: '#f59e0b' },
          { name: 'Review',      order: 3, color: '#8b5cf6' },
          { name: 'Done',        order: 4, color: '#10b981' },
        ],
      },
      tags: { create: Object.values(tags).map((tagId) => ({ tagId })) },
    },
    include: { columns: { orderBy: { order: 'asc' } } },
  });

  const col = Object.fromEntries(platform.columns.map((c) => [c.name, c.id]));

  type TaskSeed = {
    key: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    assignee?: string;
    column: string;
    createdDaysAgo: number;
    startDaysAgo?: number;
    dueInDays?: number;
    dueDaysAgo?: number;
    doneDaysAgo?: number;
    estimatedHrs?: number;
    tags?: string[];
  };

  const taskSeeds: TaskSeed[] = [
    {
      key: 'research', title: 'Phỏng vấn người dùng vòng 2',
      description: 'Phỏng vấn 8 sinh viên + 2 giảng viên về cách họ theo dõi công việc nhóm. Ghi lại pain point, không gợi ý giải pháp.',
      status: 'DONE', priority: 'HIGH', assignee: u.linh, column: 'Done',
      createdDaysAgo: 44, startDaysAgo: 43, dueDaysAgo: 38, doneDaysAgo: 39, estimatedHrs: 12, tags: ['research'],
    },
    {
      key: 'schema', title: 'Thiết kế lại schema database',
      description: 'Bổ sung bảng Comment, Mention, TimeLog, Notification. Chốt quan hệ trước khi code service.',
      status: 'DONE', priority: 'CRITICAL', assignee: u.minhtq, column: 'Done',
      createdDaysAgo: 44, startDaysAgo: 41, dueDaysAgo: 35, doneDaysAgo: 36, estimatedHrs: 8, tags: ['backend'],
    },
    {
      key: 'auth', title: 'Auth với refresh token rotation',
      description: 'Access token 15 phút, refresh token 7 ngày, xoay vòng mỗi lần refresh. Đổi mật khẩu phải thu hồi hết token cũ.',
      status: 'DONE', priority: 'CRITICAL', assignee: u.minhtq, column: 'Done',
      createdDaysAgo: 44, startDaysAgo: 38, dueDaysAgo: 30, doneDaysAgo: 31, estimatedHrs: 16, tags: ['backend'],
    },
    {
      key: 'kanban', title: 'Kanban board kéo thả',
      description: 'Dùng @dnd-kit. Thả sang cột khác phải đổi status và giữ đúng thứ tự thẻ.',
      status: 'DONE', priority: 'HIGH', assignee: u.hoaian, column: 'Done',
      createdDaysAgo: 44, startDaysAgo: 32, dueDaysAgo: 22, doneDaysAgo: 23, estimatedHrs: 20, tags: ['frontend'],
    },
    {
      key: 'gantt', title: 'Gantt chart theo ngày',
      description: 'Timeline ngang, có đường "hôm nay", cuối tuần làm mờ. Mũi tên phụ thuộc làm ở task riêng.',
      status: 'DONE', priority: 'MEDIUM', assignee: u.hoaian, column: 'Done',
      createdDaysAgo: 44, startDaysAgo: 26, dueDaysAgo: 14, doneDaysAgo: 15, estimatedHrs: 18, tags: ['frontend'],
    },
    {
      key: 'notify', title: 'Thông báo realtime qua Socket.io',
      description: 'Chuông trên top bar, đếm số chưa đọc, bấm vào là nhảy tới task. Không được reload trang mới thấy.',
      status: 'IN_REVIEW', priority: 'HIGH', assignee: u.linh, column: 'Review',
      createdDaysAgo: 44, startDaysAgo: 12, dueInDays: 2, estimatedHrs: 14, tags: ['frontend', 'backend'],
    },
    {
      key: 'comments', title: 'Bình luận có @mention',
      description: 'Gõ @ hiện gợi ý thành viên trong project. Người được nhắc nhận thông báo + email.',
      status: 'IN_PROGRESS', priority: 'HIGH', assignee: u.demouser, column: 'In Progress',
      createdDaysAgo: 44, startDaysAgo: 8, dueInDays: 4, estimatedHrs: 16, tags: ['frontend', 'backend'],
    },
    {
      key: 'timer', title: 'Bấm giờ làm việc',
      description: 'Một người chỉ chạy được một timer. Bật timer task khác thì timer cũ tự chốt lại, không mất giờ đã đếm.',
      status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: u.minhtq, column: 'In Progress',
      createdDaysAgo: 44, startDaysAgo: 6, dueInDays: 6, estimatedHrs: 10, tags: ['backend'],
    },
    {
      key: 'upload', title: 'Đính kèm file vào task',
      description: 'Kéo thả, tối đa 5 file × 10MB, chặn file thực thi. Ảnh phải xem trước được.',
      status: 'TODO', priority: 'MEDIUM', assignee: u.hoaian, column: 'To Do',
      createdDaysAgo: 44, dueInDays: 9, estimatedHrs: 12, tags: ['frontend', 'backend'],
    },
    {
      key: 'report', title: 'Báo cáo burndown và workload',
      description: 'Burndown so đường thực tế với đường lý tưởng. Workload hiện open/done/quá hạn + giờ đã log mỗi người.',
      status: 'TODO', priority: 'HIGH', assignee: u.linh, column: 'To Do',
      createdDaysAgo: 44, dueInDays: 11, estimatedHrs: 14, tags: ['frontend'],
    },
    {
      // Added mid-sprint — a bug found after kickoff, so the burndown ticks up once.
      key: 'overdue', title: 'Sửa lỗi lệch múi giờ ở deadline',
      description: 'Task hạn 17:00 hôm nay đang hiển thị thành "Ngày mai" với máy lệch múi giờ. Phải so theo ngày địa phương.',
      status: 'TODO', priority: 'CRITICAL', assignee: u.demouser, column: 'To Do',
      createdDaysAgo: 11, dueDaysAgo: 3, estimatedHrs: 3, tags: ['bug', 'frontend'],
    },
    {
      key: 'docs', title: 'Viết tài liệu bàn giao',
      description: 'README chạy được từ máy trắng, sơ đồ kiến trúc, danh sách endpoint.',
      status: 'BACKLOG', priority: 'LOW', column: 'Backlog',
      createdDaysAgo: 44, dueInDays: 14, estimatedHrs: 8, tags: ['docs'],
    },
    {
      key: 'darkmode', title: 'Rà lại dark mode toàn bộ màn hình',
      description: 'Vài chỗ chữ xám trên nền tối đọc không ra, nhất là bảng báo cáo.',
      status: 'BACKLOG', priority: 'LOW', assignee: u.khanhpb, column: 'Backlog',
      createdDaysAgo: 4, dueInDays: 18, estimatedHrs: 6, tags: ['design', 'frontend'],
    },
    {
      key: 'dropped', title: 'Tích hợp đăng nhập Google',
      description: 'Hoãn: ngoài phạm vi môn học, để lại cho bản sau.',
      status: 'CANCELLED', priority: 'LOW', column: 'Backlog',
      createdDaysAgo: 44, estimatedHrs: 10, tags: ['backend'],
    },
  ];

  const t: Record<string, string> = {};
  let order = 0;
  for (const s of taskSeeds) {
    const task = await prisma.task.create({
      data: {
        projectId: platform.id,
        columnId: col[s.column],
        creatorId: s.key === 'research' ? u.linh : u.demouser,
        assigneeId: s.assignee,
        title: s.title,
        description: s.description,
        status: s.status,
        priority: s.priority,
        order: order++,
        createdAt: daysAgo(s.createdDaysAgo),
        startDate: s.startDaysAgo !== undefined ? daysAgo(s.startDaysAgo) : undefined,
        dueDate: s.dueInDays !== undefined ? daysAhead(s.dueInDays) : s.dueDaysAgo !== undefined ? daysAgo(s.dueDaysAgo, 17) : undefined,
        completedAt: s.doneDaysAgo !== undefined ? daysAgo(s.doneDaysAgo) : undefined,
        estimatedHrs: s.estimatedHrs,
        ...(s.tags && { tags: { create: s.tags.map((name) => ({ tagId: tags[name] })) } }),
      },
      select: { id: true },
    });
    t[s.key] = task.id;
  }

  /* ── Subtasks ── */
  const subtasks: [string, string, TaskStatus, string | undefined][] = [
    ['comments', 'API POST/GET bình luận', 'DONE', u.demouser],
    ['comments', 'Parse @handle thành mention', 'DONE', u.demouser],
    ['comments', 'Dropdown gợi ý khi gõ @', 'IN_PROGRESS', u.hoaian],
    ['comments', 'Sửa và xoá bình luận của mình', 'TODO', u.demouser],
    ['report', 'Endpoint /reports/burndown', 'TODO', u.linh],
    ['report', 'Vẽ biểu đồ SVG', 'TODO', u.linh],
    ['upload', 'Cấu hình multer + whitelist mime', 'TODO', u.minhtq],
    ['upload', 'Vùng kéo thả có thanh tiến trình', 'TODO', u.hoaian],
  ];
  let subOrder = 0;
  for (const [parent, title, status, assignee] of subtasks) {
    await prisma.task.create({
      data: {
        projectId: platform.id, parentId: t[parent], creatorId: u.demouser, assigneeId: assignee,
        title, status, priority: 'MEDIUM', order: subOrder++,
        createdAt: daysAgo(41),
        completedAt: status === 'DONE' ? daysAgo(5) : undefined,
      },
    });
  }

  /* ── Dependencies: schema → auth → comments → notify ── */
  const deps: [string, string][] = [
    ['schema', 'auth'],
    ['auth', 'comments'],
    ['comments', 'notify'],
    ['kanban', 'gantt'],
  ];
  for (const [blocking, blocked] of deps) {
    await prisma.taskDependency.create({
      data: { blockingTaskId: t[blocking], blockedTaskId: t[blocked] },
    });
  }

  /* ── Comments: real review feedback, with mentions ── */
  const comments: { task: string; author: string; body: string; daysAgo: number; mentions?: string[] }[] = [
    {
      task: 'research', author: u.linh, daysAgo: 39,
      body: 'Đã phỏng vấn xong 10 người. Ba điểm lặp lại nhiều nhất: không biết task nào đang chờ mình, thiếu chỗ trao đổi ngay trong task, và muốn nhìn được ai đang làm gì. Chi tiết mình để trong file đính kèm.',
    },
    {
      task: 'research', author: u.demouser, daysAgo: 38,
      body: '@linh phần "không biết task nào chờ mình" đúng cái mình lo. Mình nghĩ nên làm thông báo trước rồi mới tới báo cáo, vì nó chặn luồng làm việc hằng ngày.',
      mentions: [u.linh],
    },
    {
      task: 'schema', author: u.minhtq, daysAgo: 37,
      body: 'Schema xong rồi. Có một chỗ cần quyết: Notification nên tham chiếu tới Task với onDelete SetNull hay Cascade? Mình chọn SetNull để xoá task không làm mất lịch sử thông báo.',
    },
    {
      task: 'schema', author: u.demouser, daysAgo: 36,
      body: 'SetNull hợp lý. Nhưng nhớ là client phải xử lý được trường hợp notification không còn task, đừng để bấm vào rồi văng lỗi. @minhtq ghi chú giúp vào mô tả task nhé.',
      mentions: [u.minhtq],
    },
    {
      task: 'auth', author: u.demouser, daysAgo: 32,
      body: 'Review xong. Một lỗi phải sửa trước khi merge: đổi mật khẩu mà không thu hồi refresh token cũ thì thiết bị khác vẫn đăng nhập được. Đây là lỗ hổng thật, không phải nice-to-have.',
    },
    {
      task: 'auth', author: u.minhtq, daysAgo: 31,
      body: 'Đã sửa: giờ đổi mật khẩu là xoá sạch refreshToken của user đó. Test thử bằng 2 trình duyệt, cái còn lại bị đá ra ngay lần gọi API tiếp theo.',
    },
    {
      task: 'kanban', author: u.hoaian, daysAgo: 24,
      body: 'Kéo thả chạy ổn trên desktop. Trên máy cảm ứng thì hơi khó cầm thẻ, mình thêm handle riêng ở góc trái để kéo thay vì kéo cả thẻ.',
    },
    {
      task: 'kanban', author: u.khanhpb, daysAgo: 23,
      body: 'Mình test thử với tư cách viewer: vẫn kéo thả được thẻ dù không có quyền sửa. Chỗ này cần chặn ở cả UI lẫn API nhé.',
    },
    {
      task: 'kanban', author: u.demouser, daysAgo: 22,
      body: '@khanhpb cảm ơn, đúng là lỗi phân quyền. @hoaian bạn ẩn handle kéo khi role là VIEWER, còn mình chặn ở API.',
      mentions: [u.khanhpb, u.hoaian],
    },
    {
      task: 'gantt', author: u.hoaian, daysAgo: 16,
      body: 'Timeline xong. Chưa vẽ mũi tên phụ thuộc vì API dependency chưa có — mình tách thành task riêng để không chặn phần còn lại.',
    },
    {
      task: 'notify', author: u.linh, daysAgo: 6,
      body: 'Đã lên staging. Chuông đếm đúng số chưa đọc, bấm vào là nhảy tới task. Nhờ mọi người test giúp, nhất là trường hợp mở 2 tab cùng lúc.',
    },
    {
      task: 'notify', author: u.minhtq, daysAgo: 5,
      body: 'Mở 2 tab thì cả 2 đều nhận thông báo, ổn. Nhưng đánh dấu đã đọc ở tab này thì tab kia vẫn hiện số cũ cho tới khi F5.',
    },
    {
      task: 'notify', author: u.demouser, daysAgo: 4,
      body: '@minhtq đúng rồi, mới emit lúc tạo chứ chưa emit lúc đọc. Không chặn release nhưng nên ghi vào phần hạn chế đã biết. @linh bạn thêm giúp vào mô tả task.',
      mentions: [u.minhtq, u.linh],
    },
    {
      task: 'comments', author: u.demouser, daysAgo: 3,
      body: 'API đã xong, đang làm dropdown gợi ý @. Một quyết định: chỉ những người **trong project này** mới thành mention thật, gõ @ tên người ngoài thì coi như chữ thường — tránh rò rỉ thông tin task ra ngoài nhóm.',
    },
    {
      task: 'comments', author: u.hoaian, daysAgo: 2,
      body: 'Dropdown đã chạy, điều hướng bằng phím mũi tên và Enter để chọn. Ctrl+Enter để gửi, Enter thường vẫn xuống dòng vì bình luận hay dài.',
    },
    {
      task: 'timer', author: u.minhtq, daysAgo: 2,
      body: 'Đã chặn chạy 2 timer cùng lúc: bật timer task mới thì timer cũ tự chốt lại chứ không mất giờ. Có emit sự kiện timer:conflict để client biết mà cập nhật.',
    },
    {
      task: 'overdue', author: u.khanhpb, daysAgo: 3,
      body: 'Máy mình để múi giờ UTC+7, task hạn 17:00 hôm nay hiển thị thành "Ngày mai". Chụp màn hình để ở file đính kèm.',
    },
    {
      task: 'overdue', author: u.demouser, daysAgo: 1,
      body: '@khanhpb tái hiện được rồi. Nguyên nhân là so sánh bằng giờ UTC thay vì ngày địa phương. Mình nhận task này, ưu tiên cao vì ảnh hưởng mọi deadline.',
      mentions: [u.khanhpb],
    },
  ];

  for (const c of comments) {
    await prisma.comment.create({
      data: {
        taskId: t[c.task], projectId: platform.id, authorId: c.author,
        body: c.body, createdAt: daysAgo(c.daysAgo), updatedAt: daysAgo(c.daysAgo),
        ...(c.mentions && { mentions: { create: c.mentions.map((mentionedId) => ({ mentionedId })) } }),
      },
    });
  }

  /* ── Attachments ── */
  const research = await writeAttachment('phong-van-vong-2.md', RESEARCH_MD, 'text/markdown');
  const retro = await writeAttachment('retro-theo-tuan.csv', RETRO_CSV, 'text/csv');
  const logo = await writeAttachment('sgam-logo.svg', LOGO_SVG, 'image/svg+xml');

  await prisma.file.createMany({
    data: [
      {
        uploaderId: u.linh, taskId: t.research, projectId: platform.id,
        filename: research.filename, originalName: 'phong-van-vong-2.md',
        mimeType: 'text/markdown', size: research.size, storageKey: research.storageKey,
        url: research.url, createdAt: daysAgo(39),
      },
      {
        uploaderId: u.demouser, taskId: t.report, projectId: platform.id,
        filename: retro.filename, originalName: 'retro-theo-tuan.csv',
        mimeType: 'text/csv', size: retro.size, storageKey: retro.storageKey,
        url: retro.url, createdAt: daysAgo(7),
      },
      {
        uploaderId: u.hoaian, taskId: t.darkmode, projectId: platform.id,
        filename: logo.filename, originalName: 'sgam-logo.svg',
        mimeType: 'image/svg+xml', size: logo.size, storageKey: logo.storageKey,
        url: logo.url, createdAt: daysAgo(4),
      },
    ],
  });

  /* ── Time logs ── */
  const logs: { task: string; user: string; daysAgo: number; hours: number; note?: string }[] = [
    { task: 'research', user: u.linh, daysAgo: 42, hours: 4, note: 'Phỏng vấn 4 bạn đầu' },
    { task: 'research', user: u.linh, daysAgo: 41, hours: 3.5, note: 'Phỏng vấn nhóm còn lại' },
    { task: 'research', user: u.linh, daysAgo: 40, hours: 3, note: 'Tổng hợp và viết báo cáo' },
    { task: 'schema', user: u.minhtq, daysAgo: 40, hours: 5, note: 'Vẽ ERD và rà quan hệ' },
    { task: 'schema', user: u.minhtq, daysAgo: 37, hours: 2.5 },
    { task: 'auth', user: u.minhtq, daysAgo: 36, hours: 6, note: 'JWT + refresh rotation' },
    { task: 'auth', user: u.minhtq, daysAgo: 33, hours: 4, note: 'Sửa lỗi thu hồi token sau review' },
    { task: 'kanban', user: u.hoaian, daysAgo: 30, hours: 7, note: 'Dựng dnd-kit' },
    { task: 'kanban', user: u.hoaian, daysAgo: 27, hours: 6.5, note: 'Sắp xếp lại thứ tự thẻ khi thả' },
    { task: 'kanban', user: u.hoaian, daysAgo: 24, hours: 4 },
    { task: 'gantt', user: u.hoaian, daysAgo: 20, hours: 8, note: 'Dựng lưới timeline' },
    { task: 'gantt', user: u.hoaian, daysAgo: 17, hours: 5.5 },
    { task: 'notify', user: u.linh, daysAgo: 10, hours: 6, note: 'Socket server + room theo project' },
    { task: 'notify', user: u.linh, daysAgo: 7, hours: 4.5, note: 'Chuông và dropdown' },
    { task: 'comments', user: u.demouser, daysAgo: 5, hours: 5, note: 'API bình luận' },
    { task: 'comments', user: u.demouser, daysAgo: 3, hours: 3.5, note: 'Parse mention' },
    { task: 'comments', user: u.hoaian, daysAgo: 2, hours: 4, note: 'Dropdown gợi ý @' },
    { task: 'timer', user: u.minhtq, daysAgo: 2, hours: 4.5, note: 'Chặn timer trùng' },
  ];
  for (const l of logs) {
    const startedAt = daysAgo(l.daysAgo, 9);
    const endedAt = new Date(startedAt.getTime() + l.hours * 60 * 60 * 1000);
    await prisma.timeLog.create({
      data: {
        taskId: t[l.task], userId: l.user, startedAt, endedAt,
        durationMin: Math.round(l.hours * 60), note: l.note, createdAt: startedAt,
      },
    });
  }

  /* ══ Project 2 — mới bắt đầu ════════════════════════════ */

  const onboarding = await prisma.project.create({
    data: {
      name: SEED_PROJECTS[1],
      description: 'Rút ngắn quãng đường từ lúc đăng ký tới lúc tạo project đầu tiên.',
      status: 'PLANNING', priority: 'MEDIUM',
      startDate: daysAgo(6), endDate: daysAhead(40), coverColor: '#8b5cf6',
      createdAt: daysAgo(6),
      members: {
        create: [
          { userId: u.demouser, role: ProjectRole.OWNER },
          { userId: u.hoaian, role: ProjectRole.MEMBER },
          { userId: u.khanhpb, role: ProjectRole.MEMBER },
          { userId: u.sgamadmin, role: ProjectRole.MANAGER },
          { userId: u.sgamuser, role: ProjectRole.VIEWER },
        ],
      },
      columns: {
        create: [
          { name: 'To Do', order: 0, color: '#0066cc' },
          { name: 'In Progress', order: 1, color: '#f59e0b' },
          { name: 'Done', order: 2, color: '#10b981' },
        ],
      },
    },
  });

  const onboardingTasks: [string, string | undefined, TaskStatus, Priority, string | undefined, number][] = [
    ['Vẽ luồng đăng ký hiện tại', 'Đếm số bước từ lúc mở trang tới lúc tạo xong project đầu tiên.', 'DONE', 'HIGH', u.khanhpb, 2],
    ['Dựng project mẫu khi đăng ký', 'Tài khoản mới nên có sẵn một project mẫu để bấm thử, không phải nhìn màn hình trắng.', 'IN_PROGRESS', 'HIGH', u.hoaian, 10],
    ['Checklist hướng dẫn 3 bước', undefined, 'TODO', 'MEDIUM', undefined, 16],
    ['Email chào mừng', 'Gửi sau khi đăng ký 10 phút, kèm link vào project mẫu.', 'TODO', 'LOW', undefined, 25],
  ];
  let oOrder = 0;
  for (const [title, description, status, priority, assignee, dueIn] of onboardingTasks) {
    await prisma.task.create({
      data: {
        projectId: onboarding.id, creatorId: u.demouser, assigneeId: assignee,
        title, description, status, priority, order: oOrder++,
        createdAt: daysAgo(5), dueDate: daysAhead(dueIn),
        completedAt: status === 'DONE' ? daysAgo(1) : undefined,
      },
    });
  }

  /* ══ Project 3 — đã đóng, để xem burndown hoàn chỉnh ════ */

  const growth = await prisma.project.create({
    data: {
      name: SEED_PROJECTS[2],
      description: 'Sprint tăng trưởng quý 3 — đã kết thúc, giữ lại để xem báo cáo.',
      status: 'COMPLETED', priority: 'MEDIUM',
      startDate: daysAgo(70), endDate: daysAgo(28), coverColor: '#10b981',
      createdAt: daysAgo(70),
      members: {
        create: [
          { userId: u.demouser, role: ProjectRole.OWNER },
          { userId: u.linh, role: ProjectRole.MANAGER },
          { userId: u.sgamadmin, role: ProjectRole.OWNER },
        ],
      },
    },
  });

  const growthTitles = [
    'Trang giới thiệu tính năng', 'Tối ưu tốc độ tải trang', 'Gắn tracking sự kiện',
    'A/B test nút đăng ký', 'Viết 3 bài blog', 'Dọn danh sách email',
  ];
  for (let i = 0; i < growthTitles.length; i++) {
    await prisma.task.create({
      data: {
        projectId: growth.id, creatorId: u.demouser,
        assigneeId: i % 2 === 0 ? u.demouser : u.linh,
        title: growthTitles[i], status: 'DONE', priority: 'MEDIUM', order: i,
        createdAt: daysAgo(68 - i), startDate: daysAgo(66 - i),
        dueDate: daysAgo(40 - i * 2, 17), completedAt: daysAgo(42 - i * 2),
        estimatedHrs: 6 + i,
      },
    });
  }

  /* ══ Notifications for the demo account ═════════════════ */

  const notifications: [NotificationType, string, string | undefined, boolean, number][] = [
    ['MENTIONED', 'Nguyễn Thùy Linh đã nhắc bạn trong "Thông báo realtime qua Socket.io"', t.notify, false, 0],
    ['TASK_COMMENTED', 'Phạm Bảo Khánh đã bình luận về "Sửa lỗi lệch múi giờ ở deadline"', t.overdue, false, 0],
    ['DEADLINE_APPROACHING', 'Task "Bình luận có @mention" đến hạn trong 4 ngày', t.comments, false, 1],
    ['TASK_ASSIGNED', 'Bạn được giao "Sửa lỗi lệch múi giờ ở deadline"', t.overdue, true, 1],
    ['TASK_COMMENTED', 'Trần Quang Minh đã bình luận về "Thông báo realtime qua Socket.io"', t.notify, true, 5],
    ['PROJECT_INVITE', 'Bạn được thêm vào "Customer Onboarding Revamp" với vai trò OWNER', undefined, true, 6],
    ['FILE_UPLOADED', 'Lê Hoài An đã đính kèm file vào "Rà lại dark mode toàn bộ màn hình"', t.darkmode, true, 4],
    ['TASK_ASSIGNED', 'Bạn được giao "Bình luận có @mention"', t.comments, true, 14],
  ];
  for (const [type, message, taskId, isRead, ago] of notifications) {
    await prisma.notification.create({
      data: { recipientId: u.demouser, type, taskId, message, isRead, createdAt: daysAgo(ago, 8) },
    });
  }

  await prisma.notificationPreference.upsert({
    where: { userId: u.demouser },
    update: {},
    create: { userId: u.demouser, fileUploaded: true },
  });

  /* ── Summary ── */
  const [taskCount, commentCount, logCount, notifCount] = await Promise.all([
    prisma.task.count({ where: { projectId: { in: [platform.id, onboarding.id, growth.id] } } }),
    prisma.comment.count({ where: { projectId: platform.id } }),
    prisma.timeLog.count({ where: { task: { projectId: platform.id } } }),
    prisma.notification.count({ where: { recipientId: u.demouser } }),
  ]);

  console.log(`
  Done.
    accounts     ${PEOPLE.length}

  Presentation logins
    ADMIN   admin@sgam.com / Admin1234!   global ADMIN · OWNER  · plan PRO (yearly)
    USER    user@sgam.com  / User1234!    global USER  · MEMBER · plan FREE
    OWNER   demo@test.com  / Demo1234!    project owner        · plan PRO (monthly)

  Project-role ladder (all ${PASSWORD})
    OWNER   demo@test.com
    MANAGER linh@test.com
    MEMBER  minh@test.com · an@test.com
    VIEWER  khanh@test.com

    projects     3
    tasks        ${taskCount} (including subtasks)
    comments     ${commentCount}
    time logs    ${logCount}
    files        3 (stored via ${STORAGE_TYPE})
    notifications ${notifCount} for demo@test.com

  Sign in as demo@test.com / ${PASSWORD}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
