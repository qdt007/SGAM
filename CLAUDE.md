# CLAUDE.md

Context for Claude Code working in this repo. Read `ROADMAP.md` for what is built vs. planned.

## What this is

EXE101 course project: a full-stack project management app (projects → kanban columns → tasks), monorepo with two independent npm packages, no workspace tooling.

```
server/   Node + Express + Prisma + PostgreSQL + Socket.io   (port 5000)
client/   React 18 + Vite + Tailwind + Zustand + React Query (port 5173)
```

## Running it

`start-all.bat` at the root starts PostgreSQL, backend, and frontend, then opens the browser. Demo login: `demo@test.com` / `Demo1234!`.

Manually:

```bash
cd server && npm run dev     # ts-node-dev, reads server/.env
cd client && npm run dev     # vite, proxies /api and /uploads to :5000
```

**PostgreSQL is a manual install with no Windows service.** It runs via the `PostgreSQLSvc` scheduled task that `start-all.bat` registers. When the app throws vague errors like "Failed to delete" or every request 500s, check the DB is actually up before hunting for a code bug — it usually isn't a code bug.

Prisma: `npm run prisma:migrate`, `prisma:generate`, `prisma:studio` from `server/`.

Demo data: `npm run seed` from `server/` (`prisma/seed.ts`). Its three attachments go through
`config/storage.ts` like any upload, so seeding a hosted database puts them in Cloudinary rather
than on the seeding machine. It is re-runnable — it deletes only the three projects it owns by name and the notifications of the five accounts it creates, so hand-made data survives. Everything it writes is backdated so the burndown and the time logs have a real shape; if you add tasks to it, give them a `createdAt` near the project kickoff or the curve climbs instead of falling.

Tests: `npm test` in either package (Vitest; `npm run test:watch` to iterate). Server tests are pure logic plus supertest contract tests that never touch the database — keep it that way, since there is no separate test database.

## Architecture

**Backend module pattern** — every feature is a folder under `server/src/modules/<name>/` with exactly four files:

```
<name>.routes.ts      Router, mounts middleware, no logic
<name>.controller.ts  Thin — parse req, call service, wrap in apiResponse
<name>.service.ts     All business logic, all Prisma access
<name>.schema.ts      Zod schemas consumed by validate() middleware
```

Follow this shape when adding a module; `projects/` is the fullest example. Register the router in `src/app.ts`.

Shared pieces:
- `middlewares/authenticate.ts` — verifies access token, sets `req.user`
- `middlewares/authorize.ts` — `authorizeProject('OWNER','MANAGER',...)` checks project membership role
- `middlewares/validate.ts` — Zod validation
- `utils/apiResponse.ts` — all responses go through this (`{ success, data, message }`)
- `utils/asyncHandler.ts` — wrap every async controller
- `config/socket.ts` — `emitToUser(userId, event, data)` / `emitToProject(projectId, event, data)`
- `constants/events.ts` — socket event names; use these, never string literals

**Frontend layout** — `pages/<feature>/` holds the screen only (data fetching + layout, ~150 lines); rows, cards and modals live in `components/<feature>/`. `components/<feature>/` for pieces, `api/<feature>Api.ts` for the axios layer, `hooks/` for shared logic, `stores/` for Zustand state. Server state lives in React Query; only UI/auth/socket/timer state lives in Zustand. Routes are declared in `router/AppRouter.tsx`, all lazy-loaded, all protected routes nested under `Layout`.

`api/axiosClient.ts` handles the refresh-token retry on 401 — don't add auth headers by hand.

## Current state

All nine backend modules have code: `auth`, `users`, `projects`, `tasks`, `comments`, `files`, `notifications`, `timeTracking`, `reports`. Every table in the Prisma schema is now reachable through an API. `ROADMAP.md` has the endpoint-by-endpoint list.

Things worth knowing before you change them:
- **Task-scoped routes go through `authorizeTask()`**, which resolves the task to its project and checks the caller's `ProjectRole`. Never mount a `/api/tasks/:id/...` route with `authenticate` alone — that was a real hole, fixed on 2026-09-20.
- **A user may only have one timer running at a time.** `timeTracking.service.startTimer` closes the previous one and emits `TIMER_CONFLICT` rather than letting two run.
- **@handles only become mentions for members of that project**, checked in `comments.service.create`.
- **Reports count top-level tasks only** (`parentId: null`), so the numbers match what the list, board and gantt show. Subtasks are checklist items inside a task, not scope of their own — time logged on them still counts.
- **Avatars are uploads, not URLs.** `POST/DELETE /api/users/me/avatar` store the image through
  `config/storage.ts` and keep its key in `User.avatarKey` so the previous blob is deleted on
  replace. `updateMe` clears `avatarKey` when `avatarUrl` is set to an external link, or the key
  would describe a file that is no longer being served. Render it with `components/ui/Avatar`,
  which falls back to an initial on a missing or dead image.
- **Tags are global rows** (`Tag.name` is unique table-wide); `ProjectTag` is what scopes one to a
  project. `projects.service.addTag` upserts by name so two projects share a tag rather than
  colliding, and `removeTag` also clears that tag off the project's tasks. `tasks.service.setTags`
  replaces the whole set and rejects tags outside the task's project.
- **`GET /tasks/:id` returns tags as join rows**, `{ taskId, tagId, tag }` — the `TaskTag` type,
  not `Tag`. Reach for `t.tag.name`, not `t.name`.
- **File bytes go through `config/storage.ts`, never straight to disk.** `STORAGE_TYPE` picks the backend: `local` (dev, writes to `UPLOADS_DIR`) or `cloudinary` (production). Multer buffers in memory and the backend decides where the bytes land, so `files.service` only ever sees `{ filename, storageKey, url }`. Cloudinary needs the same `resource_type` to delete that it got to upload, so `resourceTypeFor()` derives it from the mime type in both directions — change one and you orphan blobs. Image uploads drop the extension from the `public_id` because Cloudinary appends the format itself; `raw` keeps it.
- **CORS and the Socket.io handshake share `config/cors.ts`.** `CLIENT_URL` is a comma-separated list; edit `isAllowedOrigin` rather than either call site, or the two drift apart and websockets fail while REST works.
- **Socket emits are best-effort** (`io?.to(...)`), so a write never fails because the socket layer is down.
- **Notifications and email go through `enqueueNotification` / `enqueueEmailToUser`**, which fall back to a direct write/send when Redis is absent. Don't call `prisma.notification.create` or `sendMail` directly from a service — those two funnels are where `NotificationPreference` is enforced, so bypassing them sends mail a user has switched off.
- **`trust proxy` is on in production only** (`app.ts`). Render terminates TLS in front of the app; without it express-rate-limit buckets every caller under the proxy's IP.
- `README.md` still lists features as a flat wish list — `ROADMAP.md` is the status report.

## Deploying

`DEPLOY.md` is the step-by-step. Shape: client on **Vercel** (static, `client/vercel.json`), API on
**Render** (`render.yaml`, always-on Node — Socket.io and `node-cron` rule out serverless), Postgres
on **Neon**, uploads on **Cloudinary**. Secrets live in the two dashboards; `.env` stays gitignored.

## Conventions

- TypeScript strict on both sides; `npx tsc --noEmit` is currently clean in `server/` and `client/` — keep it that way.
- Tailwind utility classes only, no CSS modules. Dark mode via `dark:` variants driven by `uiStore`.
- `cn()` from `utils/cn.ts` for conditional classes.
- Existing code is written dense — short single-line stores, compact route tables. Match the file you're editing.
- Icons: `lucide-react` on most pages, `@iconify/react` on the newer Apple-styled ones.

## Charts

`components/reports/` renders its own inline SVG — no chart library. The series colors are validated for colorblind separation and surface contrast in both themes (light `#0066cc`/`#10b981`, dark `#3f8fe1`/`#1ea97c`). If you change them, re-validate rather than eyeballing, keep the value labels (the fills sit below 3:1 on the light surface, so the numbers are what make them legible), and never introduce a second y-axis.

## In-flight work

An Apple-inspired redesign is underway and uncommitted: `client/DESIGN.md` and `client/apple/DESIGN.md` hold the design tokens (Action Blue `#0066cc`, SF Pro Display, no chrome shadows), and `client/src/components/ui/` has the first three primitives — `DatePicker`, `SelectField`, `TimeDrum`. New UI should use these primitives and follow `client/DESIGN.md`.
