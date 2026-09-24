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

## Nợ kỹ thuật còn lại

- [ ] Test mới phủ logic thuần và contract API; chưa có integration test chạm DB thật (cần DB riêng cho test)
- [ ] Chưa có E2E (Playwright) cho luồng kéo thả Kanban và Gantt
- [ ] PostgreSQL cài tay, không có Windows service; phải khởi động qua scheduled task trong `start-all.bat`
