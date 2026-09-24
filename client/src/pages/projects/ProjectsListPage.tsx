import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@iconify/react';
import { SelectField, PROJECT_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../components/ui/SelectField';
import { Page, PageHeader } from '../../components/ui/Page';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { EmptyState, ErrorState, InlineError, Skeleton } from '../../components/ui/States';
import { PROJECT_STATUS_BADGE, PRIORITY_DOT, PRIORITY_LABEL } from '../../constants/taskStyles';
import { projectsApi } from '../../api/projectsApi';
import { planLimitFrom } from '../../hooks/usePlan';
import { cn } from '../../utils/cn';
import { formatRelative } from '../../utils/dateUtils';
import { Project } from '../../types';

const COVER_COLORS = ['#C2410C', '#9A3412', '#D97706', '#F59E0B', '#16A34A', '#0F766E', '#78716C', '#1C1917'];

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  coverColor: z.string().optional(),
});
type ProjectForm = z.infer<typeof projectSchema>;

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/* ─── Create / edit ──────────────────────────────── */
function ProjectModal({ onClose, project }: { onClose: () => void; project?: Project }) {
  const qc = useQueryClient();
  const isEdit = !!project;
  const [selectedColor, setSelectedColor] = useState(project?.coverColor ?? COVER_COLORS[0]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'PLANNING',
      priority: project?.priority ?? 'MEDIUM',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Project>) => (isEdit ? projectsApi.update(project.id, data) : projectsApi.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
  });

  const planLimit = planLimitFrom(mutation.error);
  const onSubmit = (data: ProjectForm) => mutation.mutate({ ...data, coverColor: selectedColor });

  return (
    <Modal
      title={isEdit ? 'Edit project' : 'New project'}
      description={isEdit ? undefined : 'Projects hold your tasks, members and contribution history.'}
      onClose={onClose}
    >
      <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {planLimit ? (
          <div className="rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2.5 text-small text-ink">
            <p className="font-semibold text-primary">{planLimit.message}</p>
            <Link to="/settings?tab=billing" onClick={onClose} className="btn-primary btn-sm mt-2.5">
              <Icon icon="ph:sparkle-duotone" width={14} aria-hidden />
              Xem gói Pro
            </Link>
          </div>
        ) : (
          <InlineError message={mutation.error ? apiMessage(mutation.error, 'Something went wrong') : null} />
        )}

        <div>
          <label htmlFor="project-name" className="label">
            Project name
          </label>
          <input
            id="project-name"
            {...register('name')}
            className={cn('input', errors.name && 'input-invalid')}
            placeholder="e.g. Capstone launch"
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="field-error">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="project-description" className="label">
            Description
          </label>
          <textarea
            id="project-description"
            {...register('description')}
            className="input resize-none"
            rows={3}
            placeholder="What is this project about?"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Status"
            value={watch('status') ?? 'PLANNING'}
            onChange={(v) => setValue('status', v as ProjectForm['status'])}
            options={PROJECT_STATUS_OPTIONS}
          />
          <SelectField
            label="Priority"
            value={watch('priority') ?? 'MEDIUM'}
            onChange={(v) => setValue('priority', v as ProjectForm['priority'])}
            options={PRIORITY_OPTIONS}
          />
        </div>

        <div>
          <span className="label">Cover colour</span>
          <div className="flex flex-wrap gap-2">
            {COVER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                aria-label={`Cover colour ${c}`}
                aria-pressed={selectedColor === c}
                className={cn(
                  'h-7 w-7 rounded-full transition-transform duration-150 hover:scale-110',
                  selectedColor === c && 'ring-2 ring-ink/70 ring-offset-2 ring-offset-surface',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary btn-sm">
            {isSubmitting && <Icon icon="ph:circle-notch" width={14} className="animate-spin" aria-hidden />}
            {isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Card ───────────────────────────────────────── */
function ProjectCard({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const remove = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowDelete(false);
    },
  });

  const done = 0; // progress needs task data; the detail page owns that view

  return (
    <>
      <article className="card-interactive group relative flex flex-col p-0">
        <div className="absolute right-2.5 top-2.5 z-10" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`Actions for ${project.name}`}
            aria-haspopup="menu"
            className="btn-ghost btn-icon-sm opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Icon icon="ph:dots-three-bold" width={16} aria-hidden />
          </button>
          {menuOpen && (
            <div role="menu" className="menu absolute right-0 top-9 w-36">
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setShowEdit(true);
                }}
                className="menu-item"
              >
                <Icon icon="ph:pencil-simple" width={15} aria-hidden /> Edit
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setShowDelete(true);
                }}
                className="menu-item text-danger hover:bg-danger/10"
              >
                <Icon icon="ph:trash" width={15} aria-hidden /> Delete
              </button>
            </div>
          )}
        </div>

        <Link to={`/projects/${project.id}`} className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-md font-semibold text-white"
              style={{ backgroundColor: project.coverColor || '#C2410C' }}
              aria-hidden
            >
              {project.name[0].toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 pr-7">
              <span className="block truncate text-md font-semibold text-ink transition-colors group-hover:text-primary">
                {project.name}
              </span>
              <span className={cn('mt-1 inline-flex', PROJECT_STATUS_BADGE[project.status])}>
                {project.status.replace('_', ' ')}
              </span>
            </span>
          </div>

          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink-muted">
            {project.description || <span className="text-ink-subtle">No description</span>}
          </p>

          <div className="mt-4 flex items-center gap-3 border-t border-line-soft pt-3 text-xs text-ink-subtle">
            <span className="inline-flex items-center gap-1">
              <Icon icon="ph:check-square" width={13} aria-hidden />
              {project._count?.tasks ?? done} tasks
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon icon="ph:users" width={13} aria-hidden />
              {project._count?.members ?? 0}
            </span>
            <span
              className="ml-auto inline-flex items-center gap-1.5"
              title={`Priority: ${PRIORITY_LABEL[project.priority]}`}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[project.priority])} aria-hidden />
              {PRIORITY_LABEL[project.priority]}
            </span>
          </div>

          <p className="mt-2 text-2xs text-ink-subtle">Updated {formatRelative(project.updatedAt)}</p>
        </Link>
      </article>

      {showEdit && <ProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showDelete && (
        <ConfirmDialog
          title="Delete project"
          message={
            <>
              Deleting <span className="font-medium text-ink">{project.name}</span> also deletes its tasks, comments and
              attachments. This cannot be undone.
            </>
          }
          loading={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  );
}

/* ─── Page ───────────────────────────────────────── */
export function ProjectsListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const {
    data: projects = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  return (
    <Page>
      <PageHeader
        title="Projects"
        description={
          isLoading ? 'Loading your projects…' : `${projects.length} project${projects.length === 1 ? '' : 's'}`
        }
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
            <Icon icon="ph:plus" width={15} aria-hidden />
            New project
          </button>
        }
      />

      {isError ? (
        <div className="card-flush">
          <ErrorState description="Your projects could not be loaded." onRetry={() => refetch()} />
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card-flush">
          <EmptyState
            icon="ph:folder-plus-duotone"
            title="No projects yet"
            description="A project is where your group's tasks, files and contribution history live."
            action={
              <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                <Icon icon="ph:plus" width={15} aria-hidden />
                Create your first project
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showCreate && <ProjectModal onClose={() => setShowCreate(false)} />}
    </Page>
  );
}
