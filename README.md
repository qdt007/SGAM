# Project Management App

Full-featured project management with React + Node.js + PostgreSQL + Socket.io.

## Quick Start

### Backend
```bash
cd server && npm install
cp .env.example .env   # fill in your values
npx prisma migrate dev --name init
npm run dev
```

### Frontend
```bash
cd client && npm install
cp .env.example .env
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Prisma Studio: `npm run prisma:studio`

See `ROADMAP.md` for the per-endpoint status and `CLAUDE.md` for the architecture.

## Features
- Auth (JWT + refresh token rotation)
- Projects & Tasks CRUD
- Kanban Board (drag & drop)
- Gantt Chart with dependencies
- Comments with @mentions
- File Uploads
- Real-time updates (Socket.io)
- In-app Notifications
- Time Tracking with live timer
- Reports: Burndown, Workload, Dashboard
- Role-based permissions (Owner/Manager/Member/Viewer), enforced down to task-scoped routes
- Dark mode
