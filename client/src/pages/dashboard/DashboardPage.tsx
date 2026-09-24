import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { projectsApi } from '../../api/projectsApi';
import { usersApi } from '../../api/usersApi';
import { useAuthStore } from '../../stores/authStore';
import { Page, PageHeader, Section, StatTile } from '../../components/ui/Page';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/States';
import { PROJECT_STATUS_BADGE } from '../../constants/taskStyles';
import { cn } from '../../utils/cn';
import { formatRelative } from '../../utils/dateUtils';

export function DashboardPage() {
  const { user } = useAuthStore();

  const {
    data: projects = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const { data: stats } = useQuery({
    queryKey: ['users', 'me', 'stats'],
    queryFn: usersApi.myStats,
  });

  const totalTasks = projects.reduce((sum, p) => sum + (p._count?.tasks ?? 0), 0);
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <Page>
      <PageHeader
        title={`Welcome back, ${user?.displayName?.split(' ')[0] ?? ''}`}
        description="Here's what's happening across your projects."
        actions={
          <Link to="/projects" className="btn-primary btn-sm">
            <Icon icon="ph:plus" width={15} aria-hidden />
            New project
          </Link>
        }
      />

      <div className="stack">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Projects"
            value={isLoading ? '—' : projects.length}
            hint={`${activeProjects} active`}
            icon="ph:folders-duotone"
          />
          <StatTile
            label="Tasks"
            value={isLoading ? '—' : totalTasks}
            hint="across all projects"
            icon="ph:check-square-duotone"
          />
          <StatTile
            label="Assigned to you"
            value={stats?.assigned ?? '—'}
            hint={`${stats?.done ?? 0} completed`}
            icon="ph:user-focus-duotone"
            tone="accent"
          />
          <StatTile
            label="Overdue"
            value={stats?.overdue ?? '—'}
            hint={stats?.overdue ? 'needs attention' : 'nothing late'}
            icon="ph:warning-circle-duotone"
            tone={stats?.overdue ? 'danger' : 'neutral'}
          />
        </div>

        <Section
          title="Recent projects"
          actions={
            <Link to="/projects" className="btn-ghost btn-sm">
              View all
              <Icon icon="ph:arrow-right" width={14} aria-hidden />
            </Link>
          }
        >
          <div className="card-flush overflow-hidden">
            {isError ? (
              <ErrorState description="Your projects could not be loaded." onRetry={() => refetch()} compact />
            ) : isLoading ? (
              <SkeletonRows rows={4} />
            ) : projects.length === 0 ? (
              <EmptyState
                icon="ph:folder-plus-duotone"
                title="No projects yet"
                description="Create your first project to start tracking work and contributions."
                action={
                  <Link to="/projects" className="btn-primary btn-sm">
                    Create a project
                  </Link>
                }
              />
            ) : (
              projects.slice(0, 6).map((project) => {
                const badge = PROJECT_STATUS_BADGE[project.status];
                return (
                  <Link key={project.id} to={`/projects/${project.id}`} className="list-row group">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                      style={{ backgroundColor: project.coverColor || '#C2410C' }}
                      aria-hidden
                    >
                      {project.name[0].toUpperCase()}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-ink transition-colors group-hover:text-primary">
                        {project.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                        {project._count?.tasks ?? 0} tasks · {project._count?.members ?? 0} members · updated{' '}
                        {formatRelative(project.updatedAt)}
                      </span>
                    </span>

                    <span className={cn('hidden shrink-0 sm:inline-flex', badge)}>
                      {project.status.replace('_', ' ')}
                    </span>
                    <Icon
                      icon="ph:caret-right"
                      width={14}
                      className="shrink-0 text-ink-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-muted"
                      aria-hidden
                    />
                  </Link>
                );
              })
            )}
          </div>
        </Section>
      </div>
    </Page>
  );
}
