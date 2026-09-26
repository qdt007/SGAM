# ROADMAP

Trạng thái thật của project, đối chiếu với danh sách Features trong `README.md`.
Kiểm chứng ngày 2026-09-20 bằng cách đọc code + chạy thử API thật, không suy đoán từ README.

Quy ước: ✅ xong và chạy được · 🟡 có một phần, còn thiếu · ❌ chưa có dòng code nào

---

## Phase 1 — Foundation ✅ (commit `3cb1b84`)

- ✅ Prisma schema — 15 model, migration `20260621163921_init`
- ✅ Auth: register / login / refresh token rotation / logout / me
- ✅ Middleware: authenticate, authorizeProject, validate (Zod), errorHandler, rateLimiter
- ✅ Layout + sidebar thu gọn + dark mode + Dashboard
- ✅ Projects CRUD + Tasks CRUD

## Phase 2 — Core UI ✅ (commit `8d05b1c`)

- ✅ **Kanban board** — drag & drop thật bằng `@dnd-kit`, `client/src/pages/kanban/KanbanPage.tsx`
- ✅ **Gantt chart** — timeline theo ngày/tuần, `client/src/pages/gantt/GanttPage.tsx`
- ✅ **Projects**: members + role (OWNER/MANAGER/MEMBER/VIEWER) + kanban columns + tags — 15 route
- ✅ **Tasks**: CRUD + move + subtasks (list)
- ✅ Dark mode, lazy-load route, TypeScript sạch cả hai phía

---

## Phase 3 — Đã hoàn thành (2026-09-20)

Toàn bộ 10 mục còn thiếu đã code xong, TypeScript sạch cả hai phía, và đã smoke-test bằng API thật trên DB local.

### 1. ✅ Users module — `server/src/modules/users/`
- `GET /api/users/search?q=&projectId=` — tìm theo email/username/displayName, lọc theo project
- `GET /api/users/:id`, `GET /api/users/me/stats` (số project / task đang mở / done / overdue)
- `PATCH /api/users/me` (displayName, username, avatarUrl — chặn trùng username)
- `PATCH /api/users/me/password` — đổi mật khẩu và **xoá toàn bộ refresh token** để đăng xuất thiết bị khác

### 2. ✅ Notifications — `server/src/modules/notifications/`
- `GET /api/notifications` (phân trang, `unreadOnly`), `GET /unread-count`
- `PATCH /:id/read`, `PATCH /read-all`, `DELETE /:id`, `DELETE /clear-all`
- Notification được tạo khi: assign task, được thêm vào project, có người comment vào task mình phụ trách, bị @mention, task sắp đến hạn (cron 08:00)
- Chuông + dropdown realtime: `client/src/components/notifications/NotificationBell.tsx`, gắn vào top bar của `Layout`

### 3. ✅ Comments + @mentions — `server/src/modules/comments/`
- `GET/POST /api/tasks/:taskId/comments`, `PATCH/DELETE /api/comments/:id`
- @handle chỉ thành mention nếu user **là thành viên của project đó**; tự mention mình thì bỏ qua
- Sửa comment thì dựng lại mention trong một transaction, đánh dấu `editedAt`
- UI: `components/comments/CommentList.tsx` + `CommentEditor.tsx` (autocomplete @ bằng phím mũi tên, ⌘/Ctrl+Enter để gửi)

### 4. ✅ Time tracking — `server/src/modules/timeTracking/`
- `POST /api/tasks/:id/time/start` · `/stop` · `POST /time` (log tay) · `GET /api/tasks/:id/time`
- `GET /api/time/running`, `PATCH/DELETE /api/time/:id` (chỉ chủ sở hữu log mới sửa/xoá được)
- Mỗi user chỉ chạy **một timer tại một thời điểm**; bật timer task khác thì timer cũ được chốt lại chứ không mất
- UI: `TaskTimer` trong panel task + `ActiveTimerBadge` chạy live trên top bar, lấy trạng thái thật từ server nên F5 hay mở tab khác vẫn đúng

### 5. ✅ File uploads — `server/src/modules/files/` + `config/upload.ts`
- `POST /api/tasks/:id/files` (multer, tối đa 5 file × 10MB), `GET`, `GET /api/projects/:id/files`, `DELETE /api/files/:id`
- Whitelist mime type (ảnh, pdf, office, text, zip) — loại khác trả **415**; tên file trên đĩa là UUID, tên gốc chỉ lưu trong DB
- Xoá file thì xoá cả bản ghi lẫn blob trên đĩa
- UI: `components/files/FileAttachments.tsx` — kéo thả, thanh tiến trình, preview ảnh

### 6. ✅ Real-time (Socket.io)
- `tasks.service` emit `TASK_CREATED/UPDATED/DELETED/MOVED`; `projects.service` emit `PROJECT_UPDATED`, `MEMBER_ADDED/UPDATED/REMOVED`, `COLUMN_UPDATED`; `comments.service` emit `COMMENT_CREATED`
- Client: `hooks/useProjectRealtime.ts` join room theo project và invalidate cache React Query — gắn ở ProjectDetail, Kanban, Gantt, Reports
- Emit là best-effort: socket chưa init thì ghi DB vẫn chạy bình thường

### 7. ✅ Task dependencies
- `GET/POST /api/tasks/:id/dependencies`, `DELETE /api/tasks/:id/dependencies/:depId`, `GET /api/projects/:id/tasks/dependencies`
- Chặn phụ thuộc vòng bằng `utils/ganttHelpers.detectCycles`, chặn tự phụ thuộc, chặn liên kết khác project
- Gantt vẽ **mũi tên khuỷu** từ cạnh phải task chặn sang cạnh trái task bị chặn, sáng lên khi hover

### 8. ✅ Reports — `server/src/modules/reports/`
- `GET /api/projects/:id/reports/summary` · `/burndown` · `/workload`
- Burndown: đường còn lại thực tế so với đường lý tưởng, mỗi ngày một điểm, ngày tương lai để `null`
- Workload: mỗi thành viên có open/done/overdue + giờ ước tính + giờ đã log, cộng phần chưa ai nhận
- UI: `components/reports/BurndownChart.tsx` (SVG, crosshair + tooltip) và `WorkloadTable.tsx`; màu đã chạy qua validator CVD cho cả light và dark

### 9. ✅ Settings — đã nối API thật
- Profile lưu qua `PATCH /users/me` (sửa được cả username), đổi mật khẩu qua `PATCH /users/me/password`
- Tuỳ chọn thông báo lưu vào `localStorage` nên không reset mỗi lần mở lại

### 10. ✅ Email
- `enqueueEmail` được gọi khi assign task và khi bị @mention; `reminderJob` (cron 08:00) đã sẵn
- Không có Redis thì gửi trực tiếp, có Redis thì đẩy qua Bull queue

### Ngoài roadmap — vá lỗ hổng phân quyền
`tasksRouter` trước đây chỉ `authenticate`, nghĩa là **bất kỳ ai đăng nhập cũng đọc/sửa/xoá được task của project mình không tham gia**. Đã thêm `authorizeTask()` trong `middlewares/authorize.ts`: mọi route cấp task đều resolve task → project → kiểm tra role. `errorHandler` cũng đã tôn trọng `err.status` (trước đó mọi lỗi nghiệp vụ đều ra 500) và trả 413/415 cho lỗi multer.

---

## Đang làm dở, chưa commit

Redesign theo phong cách Apple:
- `client/DESIGN.md`, `client/apple/DESIGN.md` — bộ design token (Action Blue `#0066cc`, SF Pro Display)
- `client/src/components/ui/` — `DatePicker`, `SelectField`, `TimeDrum`
- Đã áp lên: Login, Register, Layout, Kanban, Gantt, Projects

## Phase 4 — Dọn nợ kỹ thuật (2026-09-21)

- [x] **Test runner** — Vitest ở cả hai phía, `npm test` chạy được. Server 29 test (`detectCycles` với đủ ca cycle/diamond, `extractMentions`, phân trang, và 13 test contract qua supertest: mọi route đều 401 khi thiếu token, 422 khi payload sai, 404 đúng shape). Client 15 test (utils định dạng, `useMentions` chèn/thay handle).
- [x] **Preference thông báo lưu phía server** — model `NotificationPreference` + migration `20260920152933_notification_preferences`; `GET/PATCH /api/users/me/notification-prefs`. Quan trọng: chặn **thật** ở `enqueueNotification` và `enqueueEmailToUser`, không phải chỉ ẩn trên UI. Ai chưa mở Settings thì dùng default trong schema.
- [x] **Tách page** — `ProjectDetailPage` 377 → 139 dòng, `KanbanPage` 368 → 152 dòng. Đẩy ra `components/tasks/` (TaskRow, CreateTaskModal, EditTaskModal, taskForm) và `components/kanban/` (TaskCard, KanbanColumn, AddCardForm, kanbanColumns); badge màu dùng chung ở `constants/taskStyles.ts`.
- [x] **Kanban mở panel chi tiết task** — bấm tiêu đề card mở đúng panel như ở trang danh sách, cùng contract `?task=<id>` nên link từ thông báo mở được ở cả hai màn hình.

### Lỗi test bắt được
`parsePaginationQuery` trả `NaN` khi `?page=abc` (vì `Math.max(1, NaN)` là `NaN`), kéo theo `skip: NaN` làm hỏng query Prisma. Đã sửa trong `utils/pagination.ts`.

---

## Dữ liệu demo (2026-09-21)

`npm run seed` trong `server/` dựng sẵn dữ liệu để test và demo — chạy lại được nhiều lần, chỉ xoá đúng 3 project của chính nó nên dữ liệu bạn tự tạo không mất.

- **5 tài khoản** (mật khẩu `Demo1234!`): demo@test.com (OWNER) + linh / minhtq / hoaian / khanhpb với đủ 4 vai trò OWNER, MANAGER, MEMBER, VIEWER
- **3 project**: một cái đang chạy đầy đủ dữ liệu, một cái mới lập kế hoạch, một cái đã đóng để xem báo cáo quá khứ
- **14 task cấp 1 + 8 subtask** trải đủ 6 trạng thái, có task quá hạn, task bị huỷ, 6 tag màu, 5 cột Kanban
- **18 bình luận** viết như review thật (bắt lỗi bảo mật, lỗi phân quyền, lỗi múi giờ), trong đó 5 cái có @mention
- **4 quan hệ phụ thuộc** tạo thành chuỗi schema → auth → comments → notify để Gantt vẽ mũi tên
- **18 time log** 86.5h đã log, đủ để workload có số liệu
- **3 file đính kèm thật** ghi ra đĩa (md, csv, svg) nên link mở được và ảnh xem trước được
- **8 thông báo** cho tài khoản demo, 3 cái chưa đọc

Ngày tháng đều lùi về quá khứ nên burndown có hình dáng thật: bắt đầu 11 việc, giảm còn 6, rồi nhích lên 8 do hai việc phát sinh giữa chừng — nằm trên đường lý tưởng, đọc ra được là đang chậm tiến độ.

### Sửa kèm theo
Reports trước đây đếm cả subtask (22) trong khi danh sách task chỉ hiện 14 — hai con số vênh nhau trên cùng một màn hình. Đã cho `reports.service` chỉ đếm task cấp 1 (`parentId: null`) cho khớp với list/board/gantt; giờ đã log trên subtask vẫn được tính.

---

## Phase 5 — Hoàn thiện các chức năng dang dở (2026-09-25)

Rà soát bằng cách đối chiếu endpoint backend với nơi gọi ở client; hàm API không ai gọi = UI còn thiếu.

- ✅ **Avatar** — `POST/DELETE /api/users/me/avatar` (multer riêng: chỉ PNG/JPEG/WebP/GIF, 2MB, loại SVG vì chứa script được). Cột mới `User.avatarKey` để xoá blob cũ khi thay. UI upload/xoá trong Settings, và component `ui/Avatar` thay cho chữ cái đầu ở 7 chỗ (top bar, comment, member, assignee, workload, @mention picker).
- ✅ **Tags** — trước chỉ có `GET`. Thêm `POST /projects/:id/tags`, `DELETE /projects/:id/tags/:tagId`, `PUT /tasks/:id/tags`. UI: panel Tags ở sidebar project, bộ chọn tag trong task panel, chip tag trên task row.
- ✅ **Log giờ thủ công** — `POST /api/tasks/:id/time` đã có từ trước nhưng không có UI. Thêm form ngày + số giờ + ghi chú trong `TaskTimer`.
- ✅ **Xoá tất cả thông báo** — backend đã có `DELETE /notifications/clear-all`, client thiếu cả hàm lẫn nút. Đã nối.
- ✅ **Sửa/xoá project ở trang chi tiết** — trước chỉ làm được từ trang danh sách. Tách `ProjectModal` ra `components/projects/` (đúng quy ước trong CLAUDE.md) rồi dùng lại ở cả hai nơi. Menu theo quyền: MANAGER sửa, chỉ OWNER xoá.
- ✅ **Bỏ 2FA giả** — dòng "coming soon" thay bằng **Sign out everywhere** có thật (`POST /api/auth/logout-all`, xoá sạch refresh token).
- ✅ **Sửa type sai** — `Task.tags` khai là `Tag[]` trong khi API trả `TaskTag[]`. Chưa lộ ra vì chưa chỗ nào render tag.

### Cố ý không làm
- **Cột Kanban tuỳ biến** — bảng `KanbanColumn` + 4 endpoint + 4 hàm API đều có nhưng board dùng mảng `COLUMNS` cứng trong `kanbanColumns.ts`. Chuyển board sang đọc cột từ DB là refactor lớn (KanbanPage, TaskCard, logic move `status` → `columnId`, CreateTaskModal) trên một app đang chạy thật. Board 5 cột cố định vẫn dùng tốt, nên để lại.

---

## Phase 6 — Trau chuốt + bảo mật đăng nhập (2026-09-25)

### UI
- ✅ **Nút quay lại** — `ui/BackButton`, ưu tiên lùi history, không có history thì về route cha (mở từ link/bookmark/thông báo thì `navigate(-1)` sẽ văng khỏi app). Gắn ở Kanban, Gantt, Reports, Project detail qua prop `backTo` của `PageHeader`.
- ✅ **Hỏi lại trước khi xoá** — trước chỉ project mới hỏi. Giờ 10 chỗ: task (list + board + panel), comment, file, time log, tag, thành viên, avatar, xoá sạch thông báo. Gỡ liên kết dependency **cố ý không hỏi** — không mất dữ liệu, gắn lại hai click.
- ✅ **Nút xoá task trong panel chi tiết** — trước phải ra ngoài list mới xoá được.
- ✅ **Cắt ảnh đại diện** — `ui/ImageCropper` (`react-easy-crop`), kéo/zoom trong khung tròn, xuất PNG 512×512 qua canvas. Dùng PNG chứ không JPEG để ảnh có nền trong suốt không bị hộp trắng ở dark mode. Ảnh nguồn cho tới 10MB vì bản cắt ra chỉ ~90KB. Chunk Settings tăng 22KB → 57KB (17KB gzip), chỉ tải khi mở Settings.
- ✅ **Bỏ hết `<select>` gốc** — 3 chỗ (vai trò thành viên ×2, chọn task phụ thuộc) chuyển sang `SelectField` để khớp thiết kế, kèm icon theo từng vai trò.

### Bảo mật đăng nhập
- ✅ **2FA TOTP** — `otplib` + QR. `POST /auth/2fa/setup|enable|disable`, `GET /auth/2fa`, `POST /auth/2fa/verify`. 8 mã dự phòng dùng một lần, lưu dạng bcrypt hash. Login thành 2 bước qua challenge token sống 5 phút.
- ✅ **Đăng nhập Google** — luồng authorization code phía server, không thêm thư viện (dùng `fetch`). `state` ký bằng JWT chống CSRF. Gộp tài khoản theo email **chỉ khi** Google báo `email_verified`.

### Lỗi bắt được khi làm
- `login` cũ trả nguyên user object trừ `passwordHash` → thêm `twoFactorSecret` vào là **rò secret ra client**. Đã lọc qua `toSafeUser`.
- `verifySync` của otplib **ném exception** thay vì trả `valid:false` khi mã không đủ 6 chữ số → mã dự phòng 10 ký tự làm crash. Đã chặn theo hình dạng mã trước khi gọi.
- Challenge token ký bằng `JWT_ACCESS_SECRET` nên **dùng được làm access token** → `verifyAccessToken` giờ từ chối token có claim `purpose`.
- **Refresh token chưa bao giờ được lưu.** `axiosClient` và `Layout` đều đọc `state.refreshToken` nhưng `setAuth` không nhận và `partialize` không lưu nó. Nghĩa là hết 15 phút access token là văng ra đăng nhập lại — refresh rotation chưa từng chạy. Thêm nữa server xoay refresh token mỗi lần refresh mà client chỉ lưu accessToken, nên lần thứ hai cũng hỏng. Đã sửa cả hai.

---

## Phase 7 — Thanh toán thật qua VNPay (2026-09-25)

- ✅ **`config/vnpay.ts`** — dựng URL thanh toán và xác thực callback, bám đúng thuật toán ký của VNPay 2.1.0 (mã hoá key rồi sort theo key đã mã hoá, value mã hoá với `%20`→`+`, nối lại **không** mã hoá lần nữa). Dùng `URLSearchParams` sẽ ra chuỗi khác ở `!'()*` và VNPay trả "Sai chữ ký".
- ✅ **`checkout` trả `paymentUrl`** khi có credential, không có thì giữ nguyên luồng mô phỏng — máy dev không cần tài khoản merchant vẫn chạy.
- ✅ **IPN là nguồn sự thật duy nhất** — `GET /api/billing/vnpay/ipn`, public (VNPay gọi server-to-server, không có session). Trả đúng bộ mã VNPay: 97 sai chữ ký, 01 không thấy đơn, 04 sai số tiền, 02 đã xác nhận rồi, 00 thành công.
- ✅ **Return URL chỉ để báo tin** — chuyển hướng về `/settings?tab=billing&payment=...`, không cấp quyền gì. Người dùng có thể tự gõ URL đó nên nó không được phép bật Pro.
- ✅ **Chống cộng hạn hai lần** — gọi lại cùng một IPN trả 02, không cộng thêm chu kỳ.
- ✅ **So khớp số tiền** — VNPay gửi số tiền ×100; lệch là từ chối 04.

Test thật trên DB: 7 nhánh IPN đều đúng, gói lên PRO ACTIVE đúng hạn, gọi lại lần hai không cộng thêm, người dùng huỷ thì đơn thành FAILED.

### Chưa làm
- **Tiền thật** cần đăng ký doanh nghiệp với VNPay. Tài khoản cá nhân chỉ tới sandbox, nhưng luồng code y hệt — đổi credential là chạy thật.

---

## Nợ kỹ thuật còn lại

- [ ] Test mới phủ logic thuần và contract API; chưa có integration test chạm DB thật (cần DB riêng cho test)
- [ ] Chưa có E2E (Playwright) cho luồng kéo thả Kanban và Gantt
- [ ] Email confirmation khi đăng ký — chưa làm, cần SMTP thật (Render đang để trống hết biến SMTP)
- [ ] Màn hình Google consent đang ở chế độ Testing: chỉ email nằm trong danh sách test users đăng nhập được
- [ ] Cột Kanban tuỳ biến chưa nối UI (xem "Cố ý không làm" ở trên)
- [ ] PostgreSQL cài tay, không có Windows service; phải khởi động qua scheduled task trong `start-all.bat`
