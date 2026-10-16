/**
 * Demo population: students from six Đà Nẵng universities, with projects that look lived in.
 *
 * This exists so the dashboards have something to show — the admin sign-up chart, the burndown,
 * the workload table and the revenue tile all read as flat or empty on a fresh database, which
 * tells a viewer nothing about whether they work.
 *
 * **Everything here is invented.** The names, the projects and the work are fiction; only the
 * university domains are real, and that is the one thing worth being careful about. These
 * addresses do not belong to anybody, but they are shaped exactly like addresses that do, so
 * every account created here has `emailEnabled: false` on its notification preferences. Without
 * that, one configured SMTP server and one @due.udn.vn notification is the app mailing a real
 * university about a project that does not exist.
 *
 * Re-runnable. It owns its five projects by name and its accounts by the e-mail list below, and
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
const daysAgo = (n: number, hour = 10) => {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(hour, Math.floor((n * 37) % 60), 0, 0);
  return d;
};
const daysAhead = (n: number, hour = 17) => daysAgo(-n, hour);

/* ─── Universities ───────────────────────────────────────── */

interface Uni {
  key: string;
  name: string;
  short: string;
  domain: string;
}

const UNIS: Uni[] = [
  { key: 'dtu', name: 'Đại học Duy Tân', short: 'DTU', domain: 'dtu.edu.vn' },
  { key: 'due', name: 'Trường ĐH Kinh tế — ĐH Đà Nẵng', short: 'DUE', domain: 'due.udn.vn' },
  { key: 'dut', name: 'Trường ĐH Bách khoa — ĐH Đà Nẵng', short: 'DUT', domain: 'dut.udn.vn' },
  { key: 'vku', name: 'Trường ĐH CNTT&TT Việt — Hàn', short: 'VKU', domain: 'vku.udn.vn' },
  { key: 'ued', name: 'Trường ĐH Sư phạm — ĐH Đà Nẵng', short: 'UED', domain: 'ued.udn.vn' },
  { key: 'donga', name: 'Đại học Đông Á', short: 'ĐÔNG Á', domain: 'donga.edu.vn' },
];

const uni = Object.fromEntries(UNIS.map((u) => [u.key, u])) as Record<string, Uni>;

/* ─── Students ───────────────────────────────────────────── */

interface Student {
  /** Local part of the e-mail, and the @handle. */
  id: string;
  name: string;
  uni: string;
  /** How many days ago they signed up. Spread across the chart's 14-day window on purpose. */
  joined: number;
  /** Null leaves them on Free — a campus where everyone pays is not a believable one. */
  pro?: { cycle: BillingCycle; boughtDaysAgo: number; renewals?: number };
}

const STUDENTS: Student[] = [
  // Duy Tân
  { id: 'nguyenvanhoang', name: 'Nguyễn Văn Hoàng', uni: 'dtu', joined: 13, pro: { cycle: 'YEARLY', boughtDaysAgo: 12 } },
  { id: 'tranthimyduyen', name: 'Trần Thị Mỹ Duyên', uni: 'dtu', joined: 13 },
  { id: 'lequangthinh', name: 'Lê Quang Thịnh', uni: 'dtu', joined: 12, pro: { cycle: 'MONTHLY', boughtDaysAgo: 9, renewals: 2 } },
  { id: 'phamthinhan', name: 'Phạm Thị Nhàn', uni: 'dtu', joined: 11 },
  { id: 'vothanhdat', name: 'Võ Thành Đạt', uni: 'dtu', joined: 10 },
  { id: 'dangngocmai', name: 'Đặng Ngọc Mai', uni: 'dtu', joined: 8 },

  // Kinh tế
  { id: 'buihoangnam', name: 'Bùi Hoàng Nam', uni: 'due', joined: 12, pro: { cycle: 'MONTHLY', boughtDaysAgo: 5 } },
  { id: 'nguyenthulinh', name: 'Nguyễn Thu Linh', uni: 'due', joined: 11 },
  { id: 'hoangminhtri', name: 'Hoàng Minh Trí', uni: 'due', joined: 10 },
  { id: 'truongthiha', name: 'Trương Thị Hà', uni: 'due', joined: 9, pro: { cycle: 'YEARLY', boughtDaysAgo: 7 } },
  { id: 'dinhvanphuc', name: 'Đinh Văn Phúc', uni: 'due', joined: 7 },
  { id: 'lythikimanh', name: 'Lý Thị Kim Anh', uni: 'due', joined: 6 },
  { id: 'nguyenbaolong', name: 'Nguyễn Bảo Long', uni: 'due', joined: 4 },

  // Bách khoa
  { id: 'phanducmanh', name: 'Phan Đức Mạnh', uni: 'dut', joined: 11 },
  { id: 'hothikieutrang', name: 'Hồ Thị Kiều Trang', uni: 'dut', joined: 9 },
  { id: 'nguyenhuuthang', name: 'Nguyễn Hữu Thắng', uni: 'dut', joined: 8, pro: { cycle: 'MONTHLY', boughtDaysAgo: 3 } },
  { id: 'caothiphuonguyen', name: 'Cao Thị Phương Uyên', uni: 'dut', joined: 6 },
  { id: 'tranminhkhoa', name: 'Trần Minh Khoa', uni: 'dut', joined: 5 },

  // VKU
  { id: 'nguyentuananh', name: 'Nguyễn Tuấn Anh', uni: 'vku', joined: 10 },
  { id: 'dothihongnhung', name: 'Đỗ Thị Hồng Nhung', uni: 'vku', joined: 8 },
  { id: 'lethanhtung', name: 'Lê Thanh Tùng', uni: 'vku', joined: 7, pro: { cycle: 'YEARLY', boughtDaysAgo: 6 } },
  { id: 'vuthimylinh', name: 'Vũ Thị Mỹ Linh', uni: 'vku', joined: 5 },
  { id: 'nguyendinhquan', name: 'Nguyễn Đình Quân', uni: 'vku', joined: 3 },

  // Sư phạm
  { id: 'trinhthuthao', name: 'Trịnh Thu Thảo', uni: 'ued', joined: 7 },
  { id: 'nguyenvanloc', name: 'Nguyễn Văn Lộc', uni: 'ued', joined: 5 },
  { id: 'phamthihongtham', name: 'Phạm Thị Hồng Thắm', uni: 'ued', joined: 3 },
  { id: 'dangquochuy', name: 'Đặng Quốc Huy', uni: 'ued', joined: 2 },

  // Đông Á
  { id: 'ngothikimngan', name: 'Ngô Thị Kim Ngân', uni: 'donga', joined: 4 },
  { id: 'huynhvantai', name: 'Huỳnh Văn Tài', uni: 'donga', joined: 2, pro: { cycle: 'MONTHLY', boughtDaysAgo: 1 } },
  { id: 'nguyenthanhvinh', name: 'Nguyễn Thanh Vinh', uni: 'donga', joined: 1 },
  { id: 'lethiyennhi', name: 'Lê Thị Yến Nhi', uni: 'donga', joined: 0 },
];

const emailOf = (s: Student) => `${s.id}@${uni[s.uni].domain}`;
const SEED_EMAILS = STUDENTS.map(emailOf);

/* ─── Projects ───────────────────────────────────────────── */

const SEED_PROJECTS = [
  'Khởi nghiệp: Ứng dụng đặt lịch gia sư',
  'Nghiên cứu hành vi tiêu dùng Gen Z Đà Nẵng',
  'Đồ án tốt nghiệp — Hệ thống IoT nông nghiệp',
  'CLB Lập trình VKU — Mùa hè xanh 2026',
  'Chiến dịch truyền thông Ngày hội việc làm',
];

const COLUMNS = [
  { name: 'Backlog', order: 0, color: '#64748b' },
  { name: 'Cần làm', order: 1, color: '#0D69D8' },
  { name: 'Đang làm', order: 2, color: '#f59e0b' },
  { name: 'Đang duyệt', order: 3, color: '#8b5cf6' },
  { name: 'Xong', order: 4, color: '#16a34a' },
];

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
  /** Minutes logged, by whoever is assigned. */
  logged?: number[];
}

interface ProjectSeed {
  name: string;
  description: string;
  coverColor: string;
  startedDaysAgo: number;
  owner: string;
  members: { id: string; role: ProjectRole }[];
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
    name: SEED_PROJECTS[0],
    description: 'Sản phẩm môn Khởi nghiệp — ứng dụng kết nối gia sư với phụ huynh tại Đà Nẵng.',
    coverColor: '#0D69D8',
    startedDaysAgo: 13,
    owner: 'nguyenvanhoang',
    members: [
      { id: 'nguyenvanhoang', role: ProjectRole.OWNER },
      { id: 'tranthimyduyen', role: ProjectRole.MANAGER },
      { id: 'lequangthinh', role: ProjectRole.MEMBER },
      { id: 'phamthinhan', role: ProjectRole.MEMBER },
      { id: 'vothanhdat', role: ProjectRole.MEMBER },
      { id: 'dangngocmai', role: ProjectRole.VIEWER },
    ],
    tasks: [
      { title: 'Khảo sát 50 phụ huynh quận Hải Châu', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'tranthimyduyen', createdDaysAgo: 13, doneDaysAgo: 9, estimatedHrs: 12, logged: [180, 240, 150] },
      { title: 'Phân tích đối thủ: Tutor.vn, Kyna', column: 'Xong', status: 'DONE', priority: 'MEDIUM', assignee: 'lequangthinh', createdDaysAgo: 12, doneDaysAgo: 8, estimatedHrs: 6, logged: [120, 180] },
      { title: 'Vẽ user flow đặt lịch', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'phamthinhan', createdDaysAgo: 11, doneDaysAgo: 6, estimatedHrs: 8, logged: [240, 120] },
      { title: 'Thiết kế màn hình đăng ký gia sư', column: 'Đang duyệt', status: 'IN_REVIEW', priority: 'HIGH', assignee: 'phamthinhan', createdDaysAgo: 9, dueInDays: 2, estimatedHrs: 10, logged: [180, 240] },
      { title: 'Dựng API đặt lịch', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'CRITICAL', assignee: 'lequangthinh', createdDaysAgo: 8, dueInDays: 3, estimatedHrs: 16, logged: [240, 300, 180] },
      { title: 'Tích hợp thanh toán VNPay', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'vothanhdat', createdDaysAgo: 7, dueInDays: 5, estimatedHrs: 12, logged: [120, 240] },
      { title: 'Viết kịch bản pitch 5 phút', column: 'Cần làm', status: 'TODO', priority: 'MEDIUM', assignee: 'nguyenvanhoang', createdDaysAgo: 5, dueInDays: 6, estimatedHrs: 4 },
      { title: 'Chuẩn bị slide bảo vệ', column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'tranthimyduyen', createdDaysAgo: 4, dueInDays: 7, estimatedHrs: 6 },
      { title: 'Dự toán chi phí vận hành năm đầu', column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'vothanhdat', createdDaysAgo: 3, estimatedHrs: 5 },
      { title: 'Đăng ký sở hữu trí tuệ tên thương hiệu', column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'nguyenvanhoang', createdDaysAgo: 2, estimatedHrs: 3 },
    ],
    chat: [
      { from: 'nguyenvanhoang', body: 'Chào cả nhóm, mình tạo không gian này để theo tiến độ nhé.', daysAgo: 13 },
      { from: 'tranthimyduyen', body: 'Khảo sát xong 50 phiếu rồi nha, kết quả mình để trong file đính kèm task.', daysAgo: 9 },
      { from: 'lequangthinh', body: 'API đặt lịch đang vướng phần trùng giờ, mình xử lý trong hôm nay.', daysAgo: 4 },
      { from: 'nguyenvanhoang', body: 'Thứ 6 tuần này 14h họp chốt slide bảo vệ, cả nhóm sắp xếp có mặt đầy đủ.', daysAgo: 2, pinned: true },
      { from: 'phamthinhan', body: 'Màn hình đăng ký gia sư mình đẩy lên rồi, mọi người review giúp.', daysAgo: 1 },
    ],
    blockers: [
      {
        title: 'Chưa có tài khoản merchant VNPay',
        description: 'Đăng ký sandbox cần mã số thuế của doanh nghiệp, nhóm sinh viên chưa có.',
        impact: BlockerImpact.BLOCKING,
        by: 'vothanhdat',
        daysAgo: 5,
      },
      {
        title: 'Thiếu dữ liệu giá gia sư thị trường',
        impact: BlockerImpact.SERIOUS,
        by: 'tranthimyduyen',
        daysAgo: 8,
        resolved: { by: 'lequangthinh', how: 'Lấy từ báo cáo thị trường của Sở GD-ĐT, đủ dùng cho mô hình.', daysAgo: 3 },
      },
    ],
  },
  {
    name: SEED_PROJECTS[1],
    description: 'Đề tài nghiên cứu khoa học cấp trường — hành vi mua sắm trực tuyến của sinh viên.',
    coverColor: '#0F766E',
    startedDaysAgo: 12,
    owner: 'buihoangnam',
    members: [
      { id: 'buihoangnam', role: ProjectRole.OWNER },
      { id: 'nguyenthulinh', role: ProjectRole.MANAGER },
      { id: 'hoangminhtri', role: ProjectRole.MEMBER },
      { id: 'truongthiha', role: ProjectRole.MEMBER },
      { id: 'dinhvanphuc', role: ProjectRole.MEMBER },
      { id: 'lythikimanh', role: ProjectRole.MEMBER },
      { id: 'nguyenbaolong', role: ProjectRole.VIEWER },
    ],
    tasks: [
      { title: 'Tổng quan tài liệu 20 bài báo', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'nguyenthulinh', createdDaysAgo: 12, doneDaysAgo: 8, estimatedHrs: 20, logged: [300, 240, 180, 240] },
      { title: 'Xây dựng bảng hỏi khảo sát', column: 'Xong', status: 'DONE', priority: 'CRITICAL', assignee: 'truongthiha', createdDaysAgo: 11, doneDaysAgo: 7, estimatedHrs: 10, logged: [180, 240] },
      { title: 'Thu thập 300 mẫu khảo sát', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'dinhvanphuc', createdDaysAgo: 10, doneDaysAgo: 4, estimatedHrs: 25, logged: [240, 300, 300, 180] },
      { title: 'Làm sạch dữ liệu trên SPSS', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'hoangminhtri', createdDaysAgo: 6, dueInDays: 2, estimatedHrs: 12, logged: [180, 240] },
      { title: 'Chạy mô hình hồi quy', column: 'Cần làm', status: 'TODO', priority: 'CRITICAL', assignee: 'hoangminhtri', createdDaysAgo: 5, dueInDays: 4, estimatedHrs: 15 },
      { title: 'Viết chương 4 — Kết quả nghiên cứu', column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'nguyenthulinh', createdDaysAgo: 4, dueInDays: 8, estimatedHrs: 18 },
      { title: 'Chuẩn bị poster hội nghị sinh viên NCKH', column: 'Backlog', status: 'BACKLOG', priority: 'MEDIUM', assignee: 'lythikimanh', createdDaysAgo: 3, estimatedHrs: 8 },
      { title: 'Xin xác nhận số liệu từ phòng Đào tạo', column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'buihoangnam', createdDaysAgo: 2, estimatedHrs: 2 },
    ],
    chat: [
      { from: 'buihoangnam', body: 'Deadline nộp đề tài là 30/11, mình chia việc theo chương nhé.', daysAgo: 12, pinned: true },
      { from: 'truongthiha', body: 'Bảng hỏi đã qua vòng thử nghiệm 30 mẫu, Cronbach Alpha đạt 0.82.', daysAgo: 7 },
      { from: 'dinhvanphuc', body: 'Thu đủ 300 mẫu rồi mọi người ơi, nhiều hơn dự kiến 50 mẫu.', daysAgo: 4 },
      { from: 'hoangminhtri', body: 'Dữ liệu có 18 phiếu trả lời không hợp lệ, mình loại ra nhé.', daysAgo: 2 },
    ],
    blockers: [
      {
        title: 'Bản quyền SPSS hết hạn',
        description: 'Phòng máy thực hành chỉ còn 3 máy có license, phải xếp lịch dùng chung.',
        impact: BlockerImpact.SERIOUS,
        by: 'hoangminhtri',
        daysAgo: 3,
      },
    ],
  },
  {
    name: SEED_PROJECTS[2],
    description: 'Hệ thống giám sát độ ẩm và tưới tiêu tự động cho vườn rau tại Hòa Vang.',
    coverColor: '#16A34A',
    startedDaysAgo: 11,
    owner: 'phanducmanh',
    members: [
      { id: 'phanducmanh', role: ProjectRole.OWNER },
      { id: 'hothikieutrang', role: ProjectRole.MANAGER },
      { id: 'nguyenhuuthang', role: ProjectRole.MEMBER },
      { id: 'caothiphuonguyen', role: ProjectRole.MEMBER },
      { id: 'tranminhkhoa', role: ProjectRole.MEMBER },
    ],
    tasks: [
      { title: 'Chọn cảm biến độ ẩm đất', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'nguyenhuuthang', createdDaysAgo: 11, doneDaysAgo: 8, estimatedHrs: 6, logged: [180, 120] },
      { title: 'Thiết kế mạch nguồn pin mặt trời', column: 'Xong', status: 'DONE', priority: 'CRITICAL', assignee: 'phanducmanh', createdDaysAgo: 10, doneDaysAgo: 5, estimatedHrs: 16, logged: [240, 300, 240] },
      { title: 'Lập trình firmware ESP32', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'CRITICAL', assignee: 'tranminhkhoa', createdDaysAgo: 8, dueInDays: 3, estimatedHrs: 20, logged: [300, 240, 180] },
      { title: 'Dashboard theo dõi thời gian thực', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'caothiphuonguyen', createdDaysAgo: 7, dueInDays: 5, estimatedHrs: 14, logged: [240, 180] },
      { title: 'Thử nghiệm thực địa 1 tuần', column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'hothikieutrang', createdDaysAgo: 4, dueInDays: 9, estimatedHrs: 10 },
      { title: 'Viết thuyết minh đồ án', column: 'Cần làm', status: 'TODO', priority: 'MEDIUM', assignee: 'phanducmanh', createdDaysAgo: 3, dueInDays: 12, estimatedHrs: 25 },
      { title: 'Quay video demo sản phẩm', column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'caothiphuonguyen', createdDaysAgo: 2, estimatedHrs: 6 },
    ],
    chat: [
      { from: 'phanducmanh', body: 'Linh kiện về rồi, chiều nay 15h cả nhóm qua phòng Lab C301 ráp thử.', daysAgo: 9 },
      { from: 'tranminhkhoa', body: 'ESP32 đọc cảm biến ổn, nhưng wifi ngoài vườn yếu quá, đang tính dùng LoRa.', daysAgo: 5 },
      { from: 'hothikieutrang', body: 'Thầy hướng dẫn duyệt đề cương rồi nhé, mình đã up lên drive chung.', daysAgo: 3, pinned: true },
    ],
    blockers: [
      {
        title: 'Sóng wifi không phủ tới khu vườn thử nghiệm',
        description: 'Cách nhà 80m, ESP32 mất kết nối liên tục. Đang cân nhắc chuyển sang LoRa.',
        impact: BlockerImpact.BLOCKING,
        by: 'tranminhkhoa',
        daysAgo: 5,
      },
      {
        title: 'Chưa xin được phép dùng vườn của hộ dân',
        impact: BlockerImpact.MINOR,
        by: 'hothikieutrang',
        daysAgo: 7,
        resolved: { by: 'phanducmanh', how: 'Bác chủ vườn đồng ý cho mượn 200m² trong 2 tháng.', daysAgo: 4 },
      },
    ],
  },
  {
    name: SEED_PROJECTS[3],
    description: 'Chuỗi workshop lập trình miễn phí cho sinh viên năm nhất trong hè.',
    coverColor: '#7C3AED',
    startedDaysAgo: 10,
    owner: 'nguyentuananh',
    members: [
      { id: 'nguyentuananh', role: ProjectRole.OWNER },
      { id: 'dothihongnhung', role: ProjectRole.MANAGER },
      { id: 'lethanhtung', role: ProjectRole.MEMBER },
      { id: 'vuthimylinh', role: ProjectRole.MEMBER },
      { id: 'nguyendinhquan', role: ProjectRole.MEMBER },
      { id: 'trinhthuthao', role: ProjectRole.VIEWER },
    ],
    tasks: [
      { title: 'Chốt nội dung 6 buổi workshop', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'dothihongnhung', createdDaysAgo: 10, doneDaysAgo: 7, estimatedHrs: 8, logged: [180, 240] },
      { title: 'Mời diễn giả buổi 1 và 2', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'nguyentuananh', createdDaysAgo: 9, doneDaysAgo: 5, estimatedHrs: 5, logged: [120, 150] },
      { title: 'Đặt phòng hội trường', column: 'Đang duyệt', status: 'IN_REVIEW', priority: 'MEDIUM', assignee: 'vuthimylinh', createdDaysAgo: 6, dueInDays: 1, estimatedHrs: 3, logged: [90] },
      { title: 'Thiết kế poster và ấn phẩm', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'nguyendinhquan', createdDaysAgo: 5, dueInDays: 4, estimatedHrs: 10, logged: [180, 120] },
      { title: 'Mở form đăng ký tham dự', column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'lethanhtung', createdDaysAgo: 3, dueInDays: 3, estimatedHrs: 4 },
      { title: 'Chuẩn bị quà cho người tham dự', column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'vuthimylinh', createdDaysAgo: 2, estimatedHrs: 4 },
    ],
    chat: [
      { from: 'nguyentuananh', body: 'Mục tiêu 150 bạn đăng ký, mọi người đẩy truyền thông giúp nhé.', daysAgo: 10, pinned: true },
      { from: 'dothihongnhung', body: 'Anh diễn giả buổi 2 xác nhận tham gia rồi ạ.', daysAgo: 5 },
      { from: 'nguyendinhquan', body: 'Poster bản nháp mình để trong task, mọi người góp ý màu giúp.', daysAgo: 2 },
    ],
    blockers: [
      {
        title: 'Hội trường lớn đã kín lịch tháng 7',
        description: 'Phòng Công tác sinh viên báo chỉ còn phòng 80 chỗ, không đủ cho mục tiêu 150 người.',
        impact: BlockerImpact.SERIOUS,
        by: 'vuthimylinh',
        daysAgo: 4,
      },
    ],
  },
  {
    name: SEED_PROJECTS[4],
    description: 'Truyền thông cho ngày hội việc làm thường niên của trường.',
    coverColor: '#D97706',
    startedDaysAgo: 7,
    owner: 'ngothikimngan',
    members: [
      { id: 'ngothikimngan', role: ProjectRole.OWNER },
      { id: 'huynhvantai', role: ProjectRole.MANAGER },
      { id: 'nguyenthanhvinh', role: ProjectRole.MEMBER },
      { id: 'lethiyennhi', role: ProjectRole.MEMBER },
      { id: 'phamthihongtham', role: ProjectRole.MEMBER },
      { id: 'dangquochuy', role: ProjectRole.MEMBER },
      { id: 'nguyenvanloc', role: ProjectRole.VIEWER },
    ],
    tasks: [
      { title: 'Lập kế hoạch truyền thông 3 tuần', column: 'Xong', status: 'DONE', priority: 'HIGH', assignee: 'huynhvantai', createdDaysAgo: 7, doneDaysAgo: 4, estimatedHrs: 6, logged: [180, 120] },
      { title: 'Liên hệ 20 doanh nghiệp tham gia', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'CRITICAL', assignee: 'ngothikimngan', createdDaysAgo: 6, dueInDays: 2, estimatedHrs: 15, logged: [240, 180, 120] },
      { title: 'Viết bài PR trên fanpage', column: 'Đang làm', status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'lethiyennhi', createdDaysAgo: 4, dueInDays: 3, estimatedHrs: 8, logged: [120] },
      { title: 'Dựng video teaser 30 giây', column: 'Cần làm', status: 'TODO', priority: 'HIGH', assignee: 'nguyenthanhvinh', createdDaysAgo: 3, dueInDays: 5, estimatedHrs: 12 },
      { title: 'Thiết kế gian hàng doanh nghiệp', column: 'Cần làm', status: 'TODO', priority: 'MEDIUM', assignee: 'dangquochuy', createdDaysAgo: 2, dueInDays: 6, estimatedHrs: 10 },
      { title: 'Tổng kết số liệu sau sự kiện', column: 'Backlog', status: 'BACKLOG', priority: 'LOW', assignee: 'phamthihongtham', createdDaysAgo: 1, estimatedHrs: 5 },
    ],
    chat: [
      { from: 'ngothikimngan', body: 'Ngày hội diễn ra 20/7 tại sân trường, còn đúng 3 tuần nữa.', daysAgo: 7, pinned: true },
      { from: 'huynhvantai', body: 'Mình đã có danh sách 35 doanh nghiệp từ năm ngoái để liên hệ lại.', daysAgo: 5 },
      { from: 'lethiyennhi', body: 'Bài PR đầu tiên đạt 1.2k lượt tiếp cận sau 1 ngày nha mọi người.', daysAgo: 1 },
    ],
    blockers: [
      {
        title: 'Kinh phí truyền thông chưa được duyệt',
        description: 'Đề xuất 15 triệu, phòng Tài chính đang xem xét. Chưa chạy quảng cáo được.',
        impact: BlockerImpact.BLOCKING,
        by: 'huynhvantai',
        daysAgo: 3,
      },
    ],
  },
];

/* ─── Cleanup ────────────────────────────────────────────── */

/**
 * Removes everything a previous run created, and nothing else.
 *
 * Order matters. A project cascades to its tasks, members, messages, blockers, comments and time
 * logs, but `Task.creator` and `Comment.author` are plain references with no cascade — delete the
 * accounts first and Postgres refuses, so the projects go first and the accounts follow.
 */
async function clean(): Promise<number> {
  const users = await prisma.user.findMany({ where: { email: { in: SEED_EMAILS } }, select: { id: true } });
  const ids = users.map((u) => u.id);

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
        subscriptionId: subscription.id,
        userId,
        amount,
        cycle,
        status: PaymentStatus.PAID,
        provider: 'SEED',
        providerRef: `SEED-UNI-${userId.slice(0, 8)}-${i}`,
        paidAt,
        createdAt: paidAt,
      },
    });
  }

  const startedAt = daysAgo(boughtDaysAgo + (renewals - 1) * cycleDays);
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      tier: 'PRO',
      status: 'ACTIVE',
      cycle,
      startedAt,
      currentPeriodEnd: periodEndFrom(daysAgo(boughtDaysAgo), cycle),
    },
  });
}

async function createProject(p: ProjectSeed, uid: Record<string, string>) {
  const startedAt = daysAgo(p.startedDaysAgo, 8);

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
          joinedAt: daysAgo(p.startedDaysAgo - Math.min(i, p.startedDaysAgo), 9),
        })),
      },
      columns: { create: COLUMNS },
    },
    include: { columns: { orderBy: { order: 'asc' } } },
  });

  const col = Object.fromEntries(project.columns.map((c) => [c.name, c.id]));

  for (const [i, t] of p.tasks.entries()) {
    const createdAt = daysAgo(t.createdDaysAgo, 10);
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
        completedAt: t.doneDaysAgo !== undefined ? daysAgo(t.doneDaysAgo, 16) : undefined,
        estimatedHrs: t.estimatedHrs,
        createdAt,
        updatedAt: t.doneDaysAgo !== undefined ? daysAgo(t.doneDaysAgo, 16) : createdAt,
      },
      select: { id: true },
    });

    // Time logs are closed sessions, spread backwards from when the task was created, so the
    // workload table has something to add up.
    for (const [j, minutes] of (t.logged ?? []).entries()) {
      const startedAtLog = daysAgo(t.createdDaysAgo - j - 1, 9 + j);
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
    const at = daysAgo(m.daysAgo, 11 + (m.daysAgo % 6));
    await prisma.message.create({
      data: { projectId: project.id, authorId: uid[m.from], body: m.body, pinned: m.pinned ?? false, createdAt: at },
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

  return project;
}

/* ─── Entry point ────────────────────────────────────────── */

async function main() {
  const cleanOnly = process.argv.includes('--clean');

  const removed = await clean();
  if (removed) console.log(`Removed ${removed} account(s) from a previous run.`);

  if (cleanOnly) {
    console.log('Cleaned. Nothing seeded.');
    return;
  }

  console.log('Seeding Đà Nẵng university demo data...\n');
  const uid = await createStudents();
  for (const p of PROJECTS) {
    const project = await createProject(p, uid);
    console.log(`  ${project.name}  —  ${p.members.length} thành viên, ${p.tasks.length} công việc`);
  }

  const byUni = UNIS.map((u) => `${u.short}: ${STUDENTS.filter((s) => s.uni === u.key).length}`).join(' · ');
  const pro = STUDENTS.filter((s) => s.pro).length;

  console.log(`
  Done.

  ${STUDENTS.length} sinh viên   (${byUni})
  ${PROJECTS.length} dự án, ${PROJECTS.reduce((n, p) => n + p.tasks.length, 0)} công việc
  ${pro} tài khoản Pro — doanh thu và biểu đồ đăng ký sẽ có số liệu

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
