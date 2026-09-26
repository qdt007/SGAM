import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { Layout } from '../components/layout/Layout';

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProjectsListPage = lazy(() => import('../pages/projects/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage })));
const ProjectDetailPage = lazy(() => import('../pages/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const KanbanPage = lazy(() => import('../pages/kanban/KanbanPage').then((m) => ({ default: m.KanbanPage })));
const GanttPage = lazy(() => import('../pages/gantt/GanttPage').then((m) => ({ default: m.GanttPage })));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const GoogleCallbackPage = lazy(() => import('../pages/auth/GoogleCallbackPage').then((m) => ({ default: m.GoogleCallbackPage })));

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

function AppLayout() {
  return (
    <Layout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsListPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/kanban" element={<KanbanPage />} />
          <Route path="projects/:projectId/gantt" element={<GanttPage />} />
          <Route path="projects/:projectId/reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/google" element={<GoogleCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<AppLayout />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
