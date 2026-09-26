import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { SelectField, STATUS_OPTIONS } from '../../components/ui/SelectField';
import { Page, PageHeader, Section } from '../../components/ui/Page';
import { EmptyState, ErrorState, SkeletonRows, Skeleton } from '../../components/ui/States';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { useProjectRealtime } from '../../hooks/useProjectRealtime';
import { TaskDetailPanel } from '../../components/tasks/TaskDetailPanel';
import { TaskRow } from '../../components/tasks/TaskRow';
import { CreateTaskModal } from '../../components/tasks/CreateTaskModal';
import { ProjectMembers } from '../../components/projects/ProjectMembers';
import { ProjectModal } from '../../components/projects/ProjectModal';
import { ProjectTags } from '../../components/projects/ProjectTags';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useAuthStore } from '../../stores/authStore';
import { PROJECT_STATUS_BADGE } from '../../constants/taskStyles';
import { cn } from '../../utils/cn';

const VIEWS = [
  { to: 'kanban', label: 'Board', icon: 'ph:kanban-duotone' },
  { to: 'gantt', label: 'Timeline', icon: 'ph:chart-bar-horizontal-duotone' },
  { to: 'reports', label: 'Reports', icon: 'ph:chart-line-up-duotone' },
];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useProjectRealtime(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const removeProject = useMutation({
    mutationFn: () => projectsApi.delete(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects', { replace: true });
    },
  });

  // Notifications link straight to a task via ?task=<id>, so the panel reads its state from the URL.
  const openTaskId = searchParams.get('task');
  const openTask = (taskId: string) => setSearchParams({ task: taskId }, { replace: false });
  const closeTask = () => setSearchParams({}, { replace: true });

  const {
    data: project,
    isLoading: projectLoading,
    isError,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId, statusFilter],
    queryFn: () => tasksApi.listByProject(projectId!, statusFilter ? { status: statusFilter } : {}),
    enabled: !!projectId,
  });

  if (projectLoading) {
    return (
      <Page>
        <div className="mb-6 space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <div className="card-flush">
          <SkeletonRows rows={5} />
        </div>
      </Page>
    );
  }

  if (isError || !project) {
    return (
      <Page>
        <ErrorState title="Project not found" description="It may have been deleted, or you no longer have access." />
      </Page>
    );
  }

  const myRole = project.members?.find((m) => m.userId === currentUserId)?.role;
  const canEdit = myRole === 'OWNER' || myRole === 'MANAGER';
  const canDelete = myRole === 'OWNER';

  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: 'Projects', to: '/projects' }]}
        backTo="/projects"
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: project.coverColor || '#C2410C' }}
              aria-hidden
            >
              {project.name[0].toUpperCase()}
            </span>
            <span className="truncate">{project.name}</span>
          </span>
        }
        description={project.description || undefined}
        meta={
          <>
            <span className={PROJECT_STATUS_BADGE[project.status]}>{project.status.replace('_', ' ')}</span>
            <span className="text-sm text-ink-muted">{tasks.length} tasks</span>
            <span className="text-sm text-ink-muted">{project.members?.length ?? 0} members</span>
            {tasks.length > 0 && (
              <span className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink/[0.08]">
                  <span
                    className="block h-full rounded-full bg-success transition-[width] duration-500 ease-snap"
                    style={{ width: `${progress}%` }}
                  />
                </span>
                <span className="tabular-nums">{progress}%</span>
              </span>
            )}
          </>
        }
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5 shadow-xs">
              {VIEWS.map((v) => (
                <Link
                  key={v.to}
                  to={`/projects/${projectId}/${v.to}`}
                  className="btn-ghost btn-xs gap-1.5 text-ink-muted hover:text-ink"
                >
                  <Icon icon={v.icon} width={15} aria-hidden />
                  <span className="hidden sm:inline">{v.label}</span>
                </Link>
              ))}
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
              <Icon icon="ph:plus" width={15} aria-hidden />
              Add task
            </button>
            {(canEdit || canDelete) && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Project actions"
                  aria-haspopup="menu"
                  className="btn-ghost btn-icon-sm"
                >
                  <Icon icon="ph:dots-three-bold" width={16} aria-hidden />
                </button>
                {menuOpen && (
                  <div role="menu" className="menu absolute right-0 top-9 z-20 w-40">
                    {canEdit && (
                      <button
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); setShowEdit(true); }}
                        className="menu-item"
                      >
                        <Icon icon="ph:pencil-simple" width={15} aria-hidden /> Edit project
                      </button>
                    )}
                    {canDelete && (
                      <button
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); setShowDelete(true); }}
                        className="menu-item text-red-600 dark:text-red-400"
                      >
                        <Icon icon="ph:trash" width={15} aria-hidden /> Delete project
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
        <Section
          title="Tasks"
          actions={
            <SelectField
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
              size="sm"
              className="w-40"
            />
          }
        >
          <div className="card-flush overflow-hidden">
            {tasksLoading ? (
              <SkeletonRows rows={5} />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={statusFilter ? 'ph:funnel-duotone' : 'ph:check-square-duotone'}
                title={statusFilter ? 'No tasks with this status' : 'No tasks yet'}
                description={
                  statusFilter
                    ? 'Try clearing the filter to see the rest of the project.'
                    : 'Add the first task to start tracking who does what.'
                }
                action={
                  statusFilter ? (
                    <button onClick={() => setStatusFilter('')} className="btn-secondary btn-sm">
                      Clear filter
                    </button>
                  ) : (
                    <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                      <Icon icon="ph:plus" width={15} aria-hidden />
                      Add task
                    </button>
                  )
                }
              />
            ) : (
              tasks.map((task) => <TaskRow key={task.id} task={task} projectId={projectId!} onOpen={openTask} />)
            )}
          </div>
        </Section>

        <div className={cn('space-y-6')}>
          <ProjectMembers projectId={projectId!} />
          <ProjectTags projectId={projectId!} />
        </div>
      </div>

      {showCreate && <CreateTaskModal projectId={projectId!} onClose={() => setShowCreate(false)} />}
      {showEdit && <ProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showDelete && (
        <ConfirmDialog
          title={`Delete "${project.name}"?`}
          message="Every task, comment, time log and attachment in this project is deleted with it. This cannot be undone."
          confirmLabel="Delete project"
          loading={removeProject.isPending}
          onConfirm={() => removeProject.mutate()}
          onClose={() => setShowDelete(false)}
        />
      )}
      {openTaskId && <TaskDetailPanel taskId={openTaskId} projectId={projectId!} onClose={closeTask} />}
    </Page>
  );
}
