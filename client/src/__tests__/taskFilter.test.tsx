import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

const listByProject = vi.fn();

vi.mock('../api/tasksApi', () => ({
  tasksApi: {
    listByProject: (...args: unknown[]) => listByProject(...args),
    listProjectDependencies: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    getSubtasks: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../api/projectsApi', () => ({
  projectsApi: {
    get: vi.fn().mockResolvedValue({
      id: 'p1',
      name: 'Demo',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      coverColor: '#C2410C',
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    getMembers: vi.fn().mockResolvedValue([]),
  },
}));

import { ProjectDetailPage } from '../pages/projects/ProjectDetailPage';

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/projects/p1'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/projects/:projectId', element: React.createElement(ProjectDetailPage) }),
        ),
      ),
    ),
  );
}

describe('project task filter', () => {
  beforeEach(() => {
    listByProject.mockReset();
    listByProject.mockResolvedValue([]);
  });

  it('asks the API for every task when no status is chosen', async () => {
    mount();
    await waitFor(() => expect(listByProject).toHaveBeenCalled());
    expect(listByProject).toHaveBeenCalledWith('p1', {});
  });

  it('re-queries with the chosen status', async () => {
    mount();
    await waitFor(() => expect(listByProject).toHaveBeenCalled());

    // Trigger and option share the label, so take the first match as the trigger.
    const trigger = (await screen.findAllByRole('button', { name: /All statuses/i }))[0];
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('option', { name: 'Done' }));

    await waitFor(() => {
      expect(listByProject).toHaveBeenCalledWith('p1', { status: 'DONE' });
    });
  });
});
