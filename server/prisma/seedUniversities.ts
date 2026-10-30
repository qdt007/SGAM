/**
 * Demo population: a small cohort of Đà Nẵng students with projects that look lived in.
 *
 * This exists so the dashboards have something to show — the admin sign-up chart, the burndown,
 * the workload table and the revenue tile all read as flat or empty on a fresh database, which
 * tells a viewer nothing about whether they work. It also exercises the parts of the app that a
 * screenshot cannot fake: chat with real @mentions, task comments, tags, subtasks, logged time,
 * blockers both open and resolved.
 *
 * **The writing is deliberately informal.** Students do not file tickets in full sentences, and
 * a board where every comment reads like a press release is the clearest sign the data is
 * invented. The chat and comments here use the abbreviations people actually type.
 *
 * **Everything is fiction except the university domains**, and that is the one thing worth being
 * careful about. These addresses belong to nobody, but they are shaped exactly like addresses
 * that do, so every account is created with `emailEnabled: false`. Without that, one configured
 * SMTP server and one notification is this app mailing a real university about a project that
 * does not exist.
 *
 * Re-runnable. It owns its projects by name and its accounts by the e-mail list below, and
 * deletes only those — `seed.ts`, `seedTeam.ts` and anything you made by hand are untouched.
 *
 * Run:    npm run seed:uni
 * Remove: npm run seed:uni -- --clean
 */
import 'dotenv/config';
import {
  PrismaClient,
  ProjectRole,
  TaskStatus,
  Priority,
  BillingCycle,
  PaymentStatus,
  BlockerImpact,
  BlockerStatus,
} from '@prisma/client';
import { hashPassword } from '../src/utils/hash';
import { periodEndFrom, priceFor } from '../src/constants/plans';

const prisma = new PrismaClient();

/** Fine for a classroom demo; override it if this is ever pointed at a public deployment. */
const PASSWORD = process.env.SEED_PASSWORD ?? 'Sinhvien2026!';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number, hour = 10, minute?: number) => {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, minute ?? Math.floor((n * 37) % 60), 0, 0);
  return d;
};
const daysAhead = (n: number, hour = 17) => daysAgo(-n, hour);

/* ─── Universities ───────────────────────────────────────── */

const UNIS = [
  { key: 'dtu', short: 'DTU', domain: 'dtu.edu.vn' },
  { key: 'due', short: 'DUE', domain: 'due.udn.vn' },
  { key: 'dut', short: 'DUT', domain: 'dut.udn.vn' },
  { key: 'vku', short: 'VKU', domain: 'vku.udn.vn' },
] as const;

type UniKey = (typeof UNIS)[number]['key'];
const domainOf = Object.fromEntries(UNIS.map((u) => [u.key, u.domain])) as Record<UniKey, string>;

/* ─── Students ───────────────────────────────────────────── */

interface Student {
  /** Local part of the e-mail, and the @handle people type in chat. */
  id: string;
  name: string;
  uni: UniKey;
  /** Days ago they signed up. Spread across the chart's 14-day window on purpose. */
  joined: number;
  /** Absent leaves them on Free — a campus where everyone pays is not a believable one. */
  pro?: { cycle: BillingCycle; boughtDaysAgo: number; renewals?: number };
}

const STUDENTS: Student[] = [
  { id: 'nguyenvanhoang', name: 'Nguyễn Văn Hoàng', uni: 'dtu', joined: 13, pro: { cycle: 'YEARLY', boughtDaysAgo: 12 } },
  { id: 'tranthimyduyen', name: 'Trần Thị Mỹ Duyên', uni: 'dtu', joined: 13 },
  { id: 'lequangthinh', name: 'Lê Quang Thịnh', uni: 'dtu', joined: 12, pro: { cycle: 'MONTHLY', boughtDaysAgo: 9, renewals: 2 } },
  { id: 'phamthinhan', name: 'Phạm Thị Nhàn', uni: 'dtu', joined: 11 },

  { id: 'buihoangnam', name: 'Bùi Hoàng Nam', uni: 'due', joined: 12, pro: { cycle: 'MONTHLY', boughtDaysAgo: 5 } },
  { id: 'nguyenthulinh', name: 'Nguyễn Thu Linh', uni: 'due', joined: 10 },
  { id: 'hoangminhtri', name: 'Hoàng Minh Trí', uni: 'due', joined: 9 },
  { id: 'truongthiha', name: 'Trương Thị Hà', uni: 'due', joined: 8, pro: { cycle: 'YEARLY', boughtDaysAgo: 7 } },

  { id: 'phanducmanh', name: 'Phan Đức Mạnh', uni: 'dut', joined: 11 },
  { id: 'hothikieutrang', name: 'Hồ Thị Kiều Trang', uni: 'dut', joined: 7 },
  { id: 'nguyenhuuthang', name: 'Nguyễn Hữu Thắng', uni: 'dut', joined: 6, pro: { cycle: 'MONTHLY', boughtDaysAgo: 3 } },
  { id: 'tranminhkhoa', name: 'Trần Minh Khoa', uni: 'dut', joined: 5 },

  { id: 'nguyentuananh', name: 'Nguyễn Tuấn Anh', uni: 'vku', joined: 4 },
  { id: 'dothihongnhung', name: 'Đỗ Thị Hồng Nhung', uni: 'vku', joined: 2 },
  { id: 'lethanhtung', name: 'Lê Thanh Tùng', uni: 'vku', joined: 0 },
];

const emailOf = (s: Student) => `${s.id}@${domainOf[s.uni]}`;

/**
 * Cleanup matches on the **domain**, not on the current list of names.
 *
 * Matching the list looks right until the list shrinks: cutting this seed from 31 students to 15
 * left the other 16 behind, because they were no longer named and so were never deleted — while
 * their projects went, leaving sixteen accounts belonging to nothing and inflating the user count
 * on the admin page.
 *
 * Two domains are listed that no current student uses. They were in an earlier version, and
 * dropping them from here would strand anyone still holding one, which is the whole bug.
 */
const SEED_DOMAINS = [...UNIS.map((u) => u.domain), 'ued.udn.vn', 'donga.edu.vn'];

/* ─── Shape of a project ─────────────────────────────────── */

const COLUMNS = [
  { name: 'Backlog', order: 0, color: '#64748b' },
  { name: 'Cần làm', order: 1, color: '#0D69D8' },
  { name: 'Đang làm', order: 2, color: '#f59e0b' },
  { name: 'Đang duyệt', order: 3, color: '#8b5cf6' },
  { name: 'Xong', order: 4, color: '#16a34a' },
];

/** Tag names are unique table-wide, so these are shared across projects by design. */
const TAGS: Record<string, string> = {
  'Thiết kế': '#8b5cf6',
  'Lập trình': '#0D69D8',
  'Khảo sát': '#0F766E',
  'Báo cáo': '#D97706',
  'Gấp': '#DC2626',
  'Phần cứng': '#475569',
};

interface CommentSeed {
  from: string;
  body: string;
  daysAgo: number;
}

interface TaskSeed {
  title: string;
  column: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  createdDaysAgo: number;
  dueInDays?: number;
  doneDaysAgo?: number;
  estimatedHrs?: number;
  /** Minutes per logged session, by whoever is assigned. */
  logged?: number[];
  tags?: string[];
  /** Checklist items inside the task. Reports count top-level tasks only, so these never skew it. */
  subtasks?: { title: string; done?: boolean }[];
  comments?: CommentSeed[];
}

interface ProjectSeed {
  name: string;
  description: string;
  coverColor: string;
  startedDaysAgo: number;
  owner: string;
  members: { id: string; role: ProjectRole }[];
  tags: string[];
  tasks: TaskSeed[];
  chat: { from: string; body: string; daysAgo: number; pinned?: boolean }[];
  blockers: {
    title: string;
    description?: string;
    impact: BlockerImpact;
    by: string;
    daysAgo: number;
    resolved?: { by: string; how: string; daysAgo: number };
  }[];
}

const PROJECTS: ProjectSeed[] = [
  {
    name: 'Khởi nghiệp: App đặt lịch gia sư',
    description: 'Môn Khởi nghiệp — app kết nối gia sư với phụ huynh ở Đà Nẵng. Deadline bảo vệ cuối tháng.',
    coverColor: '#0D69D8',
    startedDaysAgo: 13,
    owner: 'nguyenvanhoang',
    members: [
      { id: 'nguyenvanhoang', role: ProjectRole.OWNER },
      { id: 'tranthimyduyen', role: ProjectRole.MANAGER },
      { id: 'lequangthinh', role: ProjectRole.MEMBER },
      { id: 'phamthinhan', role: ProjectRole.MEMBER },
      { id: 'nguyenthulinh', role: ProjectRole.MEMBER },
      { id: 'lethanhtung', role: ProjectRole.VIEWER },
    ],
    tags: ['Thiết kế', 'Lập trình', 'Khảo sát', 'Gấp'],
    tasks: [
      {
        title: 'Khảo sát 50 phụ huynh quận Hải Châu',
        column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'tranthimyduyen',
        createdDaysAgo: 13, doneDaysAgo: 9, estimatedHrs: 12, logged: [180, 240, 150],
        tags: ['Khảo sát'],
        subtasks: [
          { title: 'Soạn bảng hỏi', done: true },
          { title: 'Đi 3 trường tiểu học', done: true },
          { title: 'Nhập liệu vào Sheet', done: true },
        ],
        comments: [
          { from: 'tranthimyduyen', body: 'xong 50 phiếu r nha mn, link sheet t để trong mô tả', daysAgo: 9 },
          { from: 'nguyenvanhoang', body: '@tranthimyduyen ngon, 38/50 chịu trả trên 150k/buổi là ổn r đó', daysAgo: 9 },
        ],
      },
      {
        title: 'Phân tích đối thủ (Tutor.vn, Kyna)',
        column: 'Xong', status: 'DONE', priority: 'MEDIUM', assignee: 'lequangthinh',
        createdDaysAgo: 12, doneDaysAgo: 8, estimatedHrs: 6, logged: [120, 180],
        tags: ['Khảo sát', 'Báo cáo'],
        comments: [{ from: 'lequangthinh', body: 'nói chung 2 ông kia phí cao mà ko có lọc theo quận, mình chen vô chỗ đó dc', daysAgo: 8 }],
      },
      {
        title: 'Vẽ user flow đặt lịch',
        column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'phamthinhan',
        createdDaysAgo: 11, doneDaysAgo: 6, estimatedHrs: 8, logged: [240, 120],
        tags: ['Thiết kế'],
      },
      {
        title: 'Thiết kế màn đăng ký gia sư',
        column: 'Đang duyệt', status: 'IN_REVIEW', priority: 'HIGH', assignee: 'phamthinhan',
        createdDaysAgo: 9, dueInDays: 2, estimatedHrs: 10, logged: [180, 240],
        tags: ['Thiết kế'],
        subtasks: [
          { title: 'Form thông tin cá nhân', done: true },
          { title: 'Upload bằng cấp', done: true },
          { title: 'Màn chờ duyệt', done: false },
        ],
        comments: [
          { from: 'phamthinhan', body: 'đẩy lên Figma r, @nguyenvanhoang @tranthimyduyen vô cmt giúp e vs ạ', daysAgo: 2 },
          { from: 'nguyenvanhoang', body: 'nút "Gửi hồ sơ" bé quá, phóng to lên tí. còn lại oke', daysAgo: 1 },
          { from: 'phamthinhan', body: 'dạ e sửa lun', daysAgo: 1 },
        ],
      },
      {
        title: 'Dựng API đặt lịch',
        column: 'Đang làm', status: 'IN_PROGRESS', priority: 'CRITICAL', assignee: 'lequangthinh',
        createdDaysAgo: 8, dueInDays: 3, estimatedHrs: 16, logged: [240, 300, 180],
        tags: ['Lập trình', 'Gấp'],
        subtasks: [
          { title: 'CRUD lịch trống', done: true },
          { title: 'Check trùng giờ', done: false },
          { title: 'Gửi mail xác nhận', done: false },
        ],
        comments: [
          { from: 'lequangthinh', body: 'phần check trùng giờ hơi khoai, 2 phụ huynh đặt cùng lúc là bị đè nhau', daysAgo: 4 },
          { from: 'nguyenthulinh', body: 'khoá theo slot thử xem b, kiểu ai vô trc thì giữ 5p', daysAgo: 4 },
          { from: 'lequangthinh', body: '@nguyenthulinh ukm để t thử, cảm ơn nha', daysAgo: 3 },
        ],
      },
      {
        title: 'Viết kịch bản pitch 5 phút',
        column: 'Cần làm', status: 'TODO', priority: 'MEDIUM', assignee: 'nguyenvanhoang',
        createdDaysAgo: 5, dueInDays: 6, estimatedHrs: 4, tags: ['Báo cáo'],
      },
      {
        title: 'Chuẩn bị slide bảo vệ',
        column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'tranthimyduyen',
        createdDaysAgo: 4, dueInDays: 7, estimatedHrs: 6, tags: ['Báo cáo', 'Gấp'],
        comments: [{ from: 'tranthimyduyen', body: 'ai có template slide đẹp đẹp ko cho t xin vs', daysAgo: 3 }],
      },
      {
        title: 'Dự toán chi phí vận hành năm đầu',
        column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'nguyenthulinh',
        createdDaysAgo: 3, estimatedHrs: 5, tags: ['Báo cáo'],
      },
    ],
    chat: [
      { from: 'nguyenvanhoang', body: 'ê mn, t tạo chỗ này để theo tiến độ cho dễ nha, khỏi lục zalo', daysAgo: 13 },
      { from: 'tranthimyduyen', body: 'oke lun', daysAgo: 13 },
      { from: 'phamthinhan', body: 'app nhìn xịn ghê =))', daysAgo: 12 },
      { from: 'tranthimyduyen', body: 'khảo sát xong r nhe, số liệu t để trong task lun', daysAgo: 9 },
      { from: 'lequangthinh', body: 'api đặt lịch t đang vướng chỗ trùng giờ, chắc tối nay mới xong', daysAgo: 4 },
      { from: 'nguyenvanhoang', body: 'ko sao, cứ từ từ. mà nhớ đừng để tới sát deadline nha =))', daysAgo: 4 },
      {
        from: 'nguyenvanhoang',
        body: 'THỨ 6 TUẦN NÀY 14H HỌP CHỐT SLIDE BẢO VỆ nha mn. Ai bận thì nhắn t trước, đừng im lặng rồi vắng.',
        daysAgo: 2, pinned: true,
      },
      { from: 'phamthinhan', body: 'dạ e có mặt ạ', daysAgo: 2 },
      { from: 'nguyenthulinh', body: 't đi dc', daysAgo: 1 },
      { from: 'lequangthinh', body: 'hic t trùng lịch học, t vô muộn 15p dc ko a', daysAgo: 1 },
    ],
    blockers: [
      {
        title: 'Chưa có tài khoản merchant để test thanh toán',
        description: 'Đăng ký sandbox đòi mã số thuế doanh nghiệp, nhóm sinh viên ko có. Đang hỏi thầy xem mượn dc của trường ko.',
        impact: BlockerImpact.BLOCKING, by: 'lequangthinh', daysAgo: 5,
      },
      {
        title: 'Thiếu số liệu giá gia sư thị trường',
        impact: BlockerImpact.SERIOUS, by: 'tranthimyduyen', daysAgo: 8,
        resolved: { by: 'nguyenthulinh', how: 'Lấy từ báo cáo của Sở GD-ĐT 2025, đủ dùng cho mô hình tài chính.', daysAgo: 3 },
      },
    ],
  },

  {
    name: 'NCKH: Hành vi mua sắm online của Gen Z',
    description: 'Đề tài nghiên cứu khoa học cấp trường. Nộp bản full trước 30/11.',
    coverColor: '#0F766E',
    startedDaysAgo: 12,
    owner: 'buihoangnam',
    members: [
      { id: 'buihoangnam', role: ProjectRole.OWNER },
      { id: 'truongthiha', role: ProjectRole.MANAGER },
      { id: 'hoangminhtri', role: ProjectRole.MEMBER },
      { id: 'nguyenthulinh', role: ProjectRole.MEMBER },
      { id: 'dothihongnhung', role: ProjectRole.MEMBER },
    ],
    tags: ['Khảo sát', 'Báo cáo', 'Gấp'],
    tasks: [
      {
        title: 'Tổng quan 20 bài báo liên quan',
        column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'truongthiha',
        createdDaysAgo: 12, doneDaysAgo: 8, estimatedHrs: 20, logged: [300, 240, 180, 240],
        tags: ['Báo cáo'],
        comments: [{ from: 'truongthiha', body: 'đọc xong 20 bài mà mắt muốn lòi luôn á :v', daysAgo: 8 }],
      },
      {
        title: 'Xây bảng hỏi khảo sát',
        column: 'Xong', status: 'DONE', priority: 'CRITICAL', assignee: 'truongthiha',
        createdDaysAgo: 11, doneDaysAgo: 7, estimatedHrs: 10, logged: [180, 240],
        tags: ['Khảo sát'],
        subtasks: [
          { title: 'Thang đo từ bài gốc', done: true },
          { title: 'Test thử 30 mẫu', done: true },
          { title: 'Chỉnh câu khó hiểu', done: true },
        ],
        comments: [
          { from: 'truongthiha', body: 'Cronbach Alpha 0.82 nha mn, ngon r', daysAgo: 7 },
          { from: 'buihoangnam', body: '@truongthiha đỉnh. vậy chốt bảng hỏi này lun, ko sửa nx', daysAgo: 7 },
        ],
      },
      {
        title: 'Thu 300 mẫu khảo sát',
        column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'hoangminhtri',
        createdDaysAgo: 10, doneDaysAgo: 4, estimatedHrs: 25, logged: [240, 300, 300, 180],
        tags: ['Khảo sát'],
        comments: [
          { from: 'hoangminhtri', body: 'dc 350 mẫu lận, dư 50 =))', daysAgo: 4 },
          { from: 'dothihongnhung', body: 'ủa sao hay z, t rải form cả tuần mà ko ai điền hết huhu', daysAgo: 4 },
          { from: 'hoangminhtri', body: 't đứng canteen giờ trưa, năn nỉ từng đứa :v', daysAgo: 4 },
        ],
      },
      {
        title: 'Làm sạch dữ liệu trên SPSS',
        column: 'Đang làm', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'hoangminhtri',
        createdDaysAgo: 6, dueInDays: 2, estimatedHrs: 12, logged: [180, 240],
        tags: ['Báo cáo', 'Gấp'],
        subtasks: [
          { title: 'Loại phiếu ko hợp lệ', done: true },
          { title: 'Mã hoá biến', done: false },
        ],
        comments: [{ from: 'hoangminhtri', body: 'có 18 phiếu trả lời bừa (chọn 1 hết từ trên xuống), t loại ra nha', daysAgo: 2 }],
      },
      {
        title: 'Chạy mô hình hồi quy',
        column: 'Cần làm', status: 'TODO', priority: 'CRITICAL', assignee: 'hoangminhtri',
        createdDaysAgo: 5, dueInDays: 4, estimatedHrs: 15, tags: ['Báo cáo', 'Gấp'],
      },
      {
        title: 'Viết chương 4 — Kết quả nghiên cứu',
        column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'truongthiha',
        createdDaysAgo: 4, dueInDays: 8, estimatedHrs: 18, tags: ['Báo cáo'],
      },
      {
        title: 'Làm poster hội nghị SV NCKH',
        column: 'Backlog', status: 'BACKLOG', priority: 'MEDIUM', assignee: 'dothihongnhung',
        createdDaysAgo: 3, estimatedHrs: 8, tags: ['Thiết kế'],
      },
    ],
    chat: [
      { from: 'buihoangnam', body: 'Deadline nộp là 30/11 nha mn, còn đúng 1 tháng. Chia việc theo chương cho dễ quản lý.', daysAgo: 12, pinned: true },
      { from: 'truongthiha', body: 'ok a, e nhận chương 2 với 4', daysAgo: 12 },
      { from: 'hoangminhtri', body: 't lo phần số liệu với SPSS', daysAgo: 12 },
      { from: 'dothihongnhung', body: 'e phụ khảo sát với làm poster dc ko ạ', daysAgo: 11 },
      { from: 'buihoangnam', body: 'dc em, vậy chốt nha', daysAgo: 11 },
      { from: 'hoangminhtri', body: 'thu đủ 300 mẫu r mn ơi, dư 50 lận', daysAgo: 4 },
      { from: 'truongthiha', body: 'ghê z :v', daysAgo: 4 },
      { from: 'buihoangnam', body: '@hoangminhtri chạy hồi quy xong nhớ xuất bảng ra word lun nha, đừng để tới lúc ghép mới làm', daysAgo: 2 },
    ],
    blockers: [
      {
        title: 'Bản quyền SPSS của trường hết hạn',
        description: 'Phòng máy chỉ còn 3 máy có license, phải xếp lịch dùng chung. Chạy mô hình bị chậm lại.',
        impact: BlockerImpact.SERIOUS, by: 'hoangminhtri', daysAgo: 3,
      },
    ],
  },

  {
    name: 'Đồ án: Hệ thống IoT tưới tiêu tự động',
    description: 'Đồ án tốt nghiệp. Giám sát độ ẩm đất và tưới tự động cho vườn rau ở Hoà Vang.',
    coverColor: '#16A34A',
    startedDaysAgo: 11,
    owner: 'phanducmanh',
    members: [
      { id: 'phanducmanh', role: ProjectRole.OWNER },
      { id: 'hothikieutrang', role: ProjectRole.MANAGER },
      { id: 'nguyenhuuthang', role: ProjectRole.MEMBER },
      { id: 'tranminhkhoa', role: ProjectRole.MEMBER },
      { id: 'nguyentuananh', role: ProjectRole.MEMBER },
    ],
    tags: ['Phần cứng', 'Lập trình', 'Báo cáo'],
    tasks: [
      {
        title: 'Chọn cảm biến độ ẩm đất',
        column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'nguyenhuuthang',
        createdDaysAgo: 11, doneDaysAgo: 8, estimatedHrs: 6, logged: [180, 120],
        tags: ['Phần cứng'],
        comments: [
          { from: 'nguyenhuuthang', body: 'chốt con capacitive nha, con resistive rẻ hơn mà chôn đất 2 tuần là rỉ', daysAgo: 8 },
          { from: 'phanducmanh', body: 'ukm, đắt hơn tí mà khỏi thay', daysAgo: 8 },
        ],
      },
      {
        title: 'Thiết kế mạch nguồn pin mặt trời',
        column: 'Xong', status: 'DONE', priority: 'CRITICAL', assignee: 'phanducmanh',
        createdDaysAgo: 10, doneDaysAgo: 5, estimatedHrs: 16, logged: [240, 300, 240],
        tags: ['Phần cứng'],
        subtasks: [
          { title: 'Tính công suất tiêu thụ', done: true },
          { title: 'Chọn pin + sạc', done: true },
          { title: 'Test chạy 48h', done: true },
        ],
      },
      {
        title: 'Lập trình firmware ESP32',
        column: 'Đang làm', status: 'IN_PROGRESS', priority: 'CRITICAL', assignee: 'tranminhkhoa',
        createdDaysAgo: 8, dueInDays: 3, estimatedHrs: 20, logged: [300, 240, 180],
        tags: ['Lập trình', 'Gấp'],
        subtasks: [
          { title: 'Đọc cảm biến', done: true },
          { title: 'Gửi dữ liệu lên server', done: true },
          { title: 'Chế độ ngủ tiết kiệm pin', done: false },
          { title: 'Tự tưới theo ngưỡng', done: false },
        ],
        comments: [
          { from: 'tranminhkhoa', body: 'wifi ngoài vườn yếu quá mn ơi, cách nhà 80m là rớt lun', daysAgo: 5 },
          { from: 'nguyentuananh', body: 'thử LoRa đi b, t có module dư cho mượn', daysAgo: 5 },
          { from: 'tranminhkhoa', body: '@nguyentuananh dc lun, mai t qua lấy nha', daysAgo: 4 },
          { from: 'hothikieutrang', body: 'nhớ ghi lại vô báo cáo phần đổi wifi sang LoRa nha, thầy sẽ hỏi', daysAgo: 4 },
        ],
      },
      {
        title: 'Dashboard theo dõi realtime',
        column: 'Đang làm', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'nguyentuananh',
        createdDaysAgo: 7, dueInDays: 5, estimatedHrs: 14, logged: [240, 180],
        tags: ['Lập trình'],
        comments: [{ from: 'nguyentuananh', body: 'biểu đồ độ ẩm theo giờ xong r, còn phần cảnh báo thôi', daysAgo: 2 }],
      },
      {
        title: 'Thử nghiệm thực địa 1 tuần',
        column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'hothikieutrang',
        createdDaysAgo: 4, dueInDays: 9, estimatedHrs: 10, tags: ['Phần cứng'],
      },
      {
        title: 'Viết thuyết minh đồ án',
        column: 'Cần làm', status: 'TODO', priority: 'MEDIUM', assignee: 'phanducmanh',
        createdDaysAgo: 3, dueInDays: 12, estimatedHrs: 25, tags: ['Báo cáo'],
      },
      {
        title: 'Quay video demo sản phẩm',
        column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'nguyentuananh',
        createdDaysAgo: 2, estimatedHrs: 6,
      },
    ],
    chat: [
      { from: 'phanducmanh', body: 'linh kiện về r nha, chiều nay 15h qua Lab C301 ráp thử', daysAgo: 9 },
      { from: 'nguyenhuuthang', body: 'ok a', daysAgo: 9 },
      { from: 'tranminhkhoa', body: 't tới trễ tí nha, đang kẹt tiết', daysAgo: 9 },
      { from: 'tranminhkhoa', body: 'esp32 đọc cảm biến ổn r mà wifi ngoài vườn yếu quá :(( đang tính chuyển qua LoRa', daysAgo: 5 },
      { from: 'nguyentuananh', body: 't có module LoRa dư nè, cho mượn', daysAgo: 5 },
      { from: 'tranminhkhoa', body: 'cứu tinh =))', daysAgo: 5 },
      {
        from: 'hothikieutrang',
        body: 'Thầy duyệt đề cương r nhe mn. File t up lên drive chung, ai chưa xem thì vô xem. Tuần sau thầy hỏi tiến độ đó.',
        daysAgo: 3, pinned: true,
      },
      { from: 'phanducmanh', body: 'ngon, vậy là yên tâm phần hướng', daysAgo: 3 },
    ],
    blockers: [
      {
        title: 'Sóng wifi ko phủ tới vườn thử nghiệm',
        description: 'Cách nhà 80m, ESP32 rớt kết nối liên tục. Đang thử chuyển sang LoRa, mượn module của Tuấn Anh.',
        impact: BlockerImpact.BLOCKING, by: 'tranminhkhoa', daysAgo: 5,
      },
      {
        title: 'Chưa xin dc phép dùng vườn của hộ dân',
        impact: BlockerImpact.MINOR, by: 'hothikieutrang', daysAgo: 7,
        resolved: { by: 'phanducmanh', how: 'Bác chủ vườn đồng ý cho mượn 200m² trong 2 tháng, có ghi giấy tay.', daysAgo: 4 },
      },
    ],
  },
];

const SEED_PROJECTS = PROJECTS.map((p) => p.name);

/* ─── Cleanup ────────────────────────────────────────────── */

/**
 * Removes everything a previous run created, and nothing else.
 *
 * **Projects are found through membership, not by name.** Matching on names looks tidier right
 * up until the names change — renaming the three projects here once left the previous run's five
 * behind, and because `Task.creator`, `Comment.author` and `TimeLog.user` are plain references
 * with no cascade, deleting the accounts then failed outright. Membership cannot drift that way.
 *
 * This leans on these accounts existing for the seed and nothing else, which is true: they are
 * invented people with invented e-mail addresses. Every project they belong to is seed data.
 *
 * Order matters. A project cascades to its tasks, subtasks, members, messages, blockers,
 * comments, mentions, files and time logs — so once the projects are gone nothing references
 * the users any more and they can be deleted.
 *
 * Tag rows are left alone on purpose: `Tag.name` is unique table-wide and other projects may be
 * using the same ones. `ProjectTag` and `TaskTag` are what scope them, and those cascade.
 */
async function clean(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { OR: SEED_DOMAINS.map((d) => ({ email: { endsWith: `@${d}` } })) },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);

  if (ids.length) {
    await prisma.project.deleteMany({ where: { members: { some: { userId: { in: ids } } } } });
  }
  // Also by name, for a project whose members were somehow cleared out from under it.
  await prisma.project.deleteMany({ where: { name: { in: SEED_PROJECTS } } });

  if (ids.length) {
    await prisma.notification.deleteMany({ where: { recipientId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  return ids.length;
}

/* ─── Seeding ────────────────────────────────────────────── */

async function createStudents(): Promise<Record<string, string>> {
  const passwordHash = await hashPassword(PASSWORD);
  const byId: Record<string, string> = {};

  for (const s of STUDENTS) {
    const joinedAt = daysAgo(s.joined, 9 + (s.joined % 8));
    const user = await prisma.user.create({
      data: {
        email: emailOf(s),
        username: s.id,
        displayName: s.name,
        passwordHash,
        createdAt: joinedAt,
        updatedAt: joinedAt,
        // These addresses are shaped like real university ones. Nothing may be sent to them.
        notificationPrefs: { create: { emailEnabled: false } },
      },
      select: { id: true },
    });
    byId[s.id] = user.id;
    if (s.pro) await giveProPlan(user.id, s.pro);
  }
  return byId;
}

async function giveProPlan(userId: string, plan: NonNullable<Student['pro']>) {
  const { cycle, boughtDaysAgo, renewals = 1 } = plan;
  const amount = priceFor(cycle);
  const subscription = await prisma.subscription.create({ data: { userId }, select: { id: true } });

  const cycleDays = cycle === 'YEARLY' ? 365 : 30;
  for (let i = 0; i < renewals; i++) {
    // i = 0 is the most recent charge; earlier ones step back a full cycle each, so the payment
    // history reads like a history instead of several charges landing on one afternoon.
    const paidAt = daysAgo(boughtDaysAgo + i * cycleDays);
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id, userId, amount, cycle,
        status: PaymentStatus.PAID, provider: 'SEED',
        providerRef: `SEED-UNI-${userId.slice(0, 8)}-${i}`,
        paidAt, createdAt: paidAt,
      },
    });
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      tier: 'PRO', status: 'ACTIVE', cycle,
      startedAt: daysAgo(boughtDaysAgo + (renewals - 1) * cycleDays),
      currentPeriodEnd: periodEndFrom(daysAgo(boughtDaysAgo), cycle),
    },
  });
}

/** Tags are global rows keyed by name, so two projects asking for "Gấp" share one. */
async function ensureTags(names: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name, color: TAGS[name] ?? '#64748b' },
      update: {},
      select: { id: true },
    });
    out[name] = tag.id;
  }
  return out;
}

/**
 * Turns the @handles written into a comment body into real Mention rows, but only for people who
 * are actually in the project — the same rule `comments.service.create` enforces at runtime. A
 * seed that invented mentions outside the membership would be demonstrating a bug.
 */
function mentionedIn(body: string, memberIds: Record<string, string>, authorHandle: string): string[] {
  const handles = [...new Set([...body.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1]))];
  return handles.filter((h) => h !== authorHandle && memberIds[h]).map((h) => memberIds[h]);
}

async function createProject(p: ProjectSeed, uid: Record<string, string>) {
  const startedAt = daysAgo(p.startedDaysAgo, 8);

  // The project's tag set is the union of what it declares and what its tasks actually use. A
  // task may only carry a tag scoped to its own project — `tasks.service.setTags` enforces that
  // at runtime — so deriving the set here makes the two impossible to fall out of step, rather
  // than leaving a task pointing at a tag the project never had.
  const usedByTasks = p.tasks.flatMap((t) => t.tags ?? []);
  const tagNames = [...new Set([...p.tags, ...usedByTasks])];
  const tagIds = await ensureTags(tagNames);
  const memberHandles = Object.fromEntries(p.members.map((m) => [m.id, uid[m.id]]));

  const project = await prisma.project.create({
    data: {
      name: p.name,
      description: p.description,
      status: 'ACTIVE',
      priority: 'HIGH',
      coverColor: p.coverColor,
      startDate: startedAt,
      endDate: daysAhead(21),
      createdAt: startedAt,
      updatedAt: startedAt,
      members: {
        create: p.members.map((m, i) => ({
          userId: uid[m.id],
          role: m.role,
          joinedAt: daysAgo(Math.max(p.startedDaysAgo - i, 0), 9),
        })),
      },
      columns: { create: COLUMNS },
      tags: { create: tagNames.map((name) => ({ tagId: tagIds[name] })) },
    },
    include: { columns: { orderBy: { order: 'asc' } } },
  });

  const col = Object.fromEntries(project.columns.map((c) => [c.name, c.id]));

  for (const [i, t] of p.tasks.entries()) {
    const createdAt = daysAgo(t.createdDaysAgo, 10);
    const completedAt = t.doneDaysAgo !== undefined ? daysAgo(t.doneDaysAgo, 16) : undefined;

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        columnId: col[t.column],
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeId: uid[t.assignee],
        creatorId: uid[p.owner],
        order: (i + 1) * 1000,
        startDate: createdAt,
        dueDate: t.dueInDays !== undefined ? daysAhead(t.dueInDays) : undefined,
        completedAt,
        estimatedHrs: t.estimatedHrs,
        createdAt,
        updatedAt: completedAt ?? createdAt,
        ...(t.tags?.length && { tags: { create: t.tags.map((name) => ({ tagId: tagIds[name] })) } }),
      },
      select: { id: true },
    });

    // Subtasks are checklist items inside the task. They carry no column and no estimate, so the
    // board and the reports — which count `parentId: null` only — stay unaffected.
    for (const [j, sub] of (t.subtasks ?? []).entries()) {
      await prisma.task.create({
        data: {
          projectId: project.id,
          parentId: task.id,
          title: sub.title,
          status: sub.done ? TaskStatus.DONE : TaskStatus.TODO,
          priority: Priority.MEDIUM,
          assigneeId: uid[t.assignee],
          creatorId: uid[t.assignee],
          order: (j + 1) * 1000,
          completedAt: sub.done ? daysAgo(t.doneDaysAgo ?? t.createdDaysAgo - 1, 15) : undefined,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    for (const c of t.comments ?? []) {
      const at = daysAgo(c.daysAgo, 13 + (c.daysAgo % 5));
      const mentions = mentionedIn(c.body, memberHandles, c.from);
      await prisma.comment.create({
        data: {
          authorId: uid[c.from],
          taskId: task.id,
          projectId: project.id,
          body: c.body,
          createdAt: at,
          updatedAt: at,
          ...(mentions.length && { mentions: { create: mentions.map((mentionedId) => ({ mentionedId })) } }),
        },
      });
    }

    // Closed sessions, stepping backwards from the task's creation, so the workload table has
    // something to add up and the burndown has a slope.
    for (const [j, minutes] of (t.logged ?? []).entries()) {
      const startedAtLog = daysAgo(Math.max(t.createdDaysAgo - j - 1, 0), 9 + j);
      await prisma.timeLog.create({
        data: {
          userId: uid[t.assignee],
          taskId: task.id,
          startedAt: startedAtLog,
          endedAt: new Date(startedAtLog.getTime() + minutes * 60_000),
          durationMin: minutes,
          createdAt: startedAtLog,
        },
      });
    }
  }

  for (const m of p.chat) {
    const at = daysAgo(m.daysAgo, 11 + (m.daysAgo % 6), (m.daysAgo * 13) % 60);
    const mentions = mentionedIn(m.body, memberHandles, m.from);
    await prisma.message.create({
      data: {
        projectId: project.id,
        authorId: uid[m.from],
        body: m.body,
        pinned: m.pinned ?? false,
        createdAt: at,
        ...(mentions.length && { mentions: { create: mentions.map((mentionedId) => ({ mentionedId })) } }),
      },
    });
  }

  for (const b of p.blockers) {
    const at = daysAgo(b.daysAgo, 14);
    await prisma.blocker.create({
      data: {
        projectId: project.id,
        raisedById: uid[b.by],
        title: b.title,
        description: b.description,
        impact: b.impact,
        status: b.resolved ? BlockerStatus.RESOLVED : BlockerStatus.OPEN,
        resolution: b.resolved?.how,
        resolvedById: b.resolved ? uid[b.resolved.by] : undefined,
        resolvedAt: b.resolved ? daysAgo(b.resolved.daysAgo, 15) : undefined,
        createdAt: at,
        updatedAt: b.resolved ? daysAgo(b.resolved.daysAgo, 15) : at,
      },
    });
  }

  const counts = {
    tasks: p.tasks.length,
    subtasks: p.tasks.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0),
    comments: p.tasks.reduce((n, t) => n + (t.comments?.length ?? 0), 0),
    chat: p.chat.length,
  };
  return { project, counts };
}

/* ─── Entry point ────────────────────────────────────────── */

async function main() {
  const cleanOnly = process.argv.includes('--clean');

  const removed = await clean();
  if (removed) console.log(`Đã xoá ${removed} tài khoản của lần chạy trước.`);

  if (cleanOnly) {
    console.log('Đã dọn sạch, không seed gì thêm.');
    return;
  }

  console.log('Đang tạo dữ liệu demo sinh viên Đà Nẵng...\n');
  const uid = await createStudents();

  let totals = { tasks: 0, subtasks: 0, comments: 0, chat: 0 };
  for (const p of PROJECTS) {
    const { project, counts } = await createProject(p, uid);
    totals = {
      tasks: totals.tasks + counts.tasks,
      subtasks: totals.subtasks + counts.subtasks,
      comments: totals.comments + counts.comments,
      chat: totals.chat + counts.chat,
    };
    console.log(
      `  ${project.name}\n` +
        `      ${p.members.length} thành viên · ${counts.tasks} công việc · ${counts.subtasks} việc con · ` +
        `${counts.comments} bình luận · ${counts.chat} tin nhắn · ${p.blockers.length} khó khăn`,
    );
  }

  const byUni = UNIS.map((u) => `${u.short} ${STUDENTS.filter((s) => s.uni === u.key).length}`).join(' · ');
  const pro = STUDENTS.filter((s) => s.pro);
  const revenue = pro.reduce((sum, s) => sum + priceFor(s.pro!.cycle) * (s.pro!.renewals ?? 1), 0);

  console.log(`
  Xong.

  ${STUDENTS.length} sinh viên   (${byUni})
  ${PROJECTS.length} dự án · ${totals.tasks} công việc · ${totals.subtasks} việc con
  ${totals.comments} bình luận · ${totals.chat} tin nhắn chat · ${Object.keys(TAGS).length} nhãn
  ${pro.length} tài khoản Pro  →  doanh thu ${revenue.toLocaleString('vi-VN')} đ

  Đăng nhập thử:  ${emailOf(STUDENTS[0])}  /  ${PASSWORD}

  Dữ liệu là hư cấu, chỉ tên miền trường là thật — mọi tài khoản đã tắt nhận email
  để ứng dụng không bao giờ gửi thư tới một địa chỉ @udn.vn nào.

  Xoá sạch:  npm run seed:uni -- --clean
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
