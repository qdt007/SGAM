import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ProjectsListPage } from '../pages/projects/ProjectsListPage';
import { ProjectDetailPage } from '../pages/projects/ProjectDetailPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { KanbanPage } from '../pages/kanban/KanbanPage';
import { GanttPage } from '../pages/gantt/GanttPage';
import { Layout } from '../components/layout/Layout';

function mount(node: React.ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(Routes, null, React.createElement(Route, { path: '*', element: node })),
      ),
    ),
  );
}

const SCREENS: [string, React.ReactNode, string][] = [
  ['Layout', React.createElement(Layout, null, 'x'), '/dashboard'],
  ['Dashboard', React.createElement(DashboardPage), '/dashboard'],
  ['ProjectsList', React.createElement(ProjectsListPage), '/projects'],
  ['ProjectDetail', React.createElement(ProjectDetailPage), '/projects/p1'],
  ['Settings', React.createElement(SettingsPage), '/settings'],
  ['Reports', React.createElement(ReportsPage), '/projects/p1/reports'],
  ['Kanban', React.createElement(KanbanPage), '/projects/p1/kanban'],
  ['Gantt', React.createElement(GanttPage), '/projects/p1/gantt'],
];

describe('screens render without throwing', () => {
  it.each(SCREENS)('%s', (name, node, path) => {
    expect(() => mount(node, path)).not.toThrow();
  });
});
