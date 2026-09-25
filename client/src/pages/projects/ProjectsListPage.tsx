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
import { ProjectModal } from '../../components/projects/ProjectModal';
import { planLimitFrom } from '../../hooks/usePlan';
import { cn } from '../../utils/cn';
import { formatRelative } from '../../utils/dateUtils';
import { Project } from '../../types';


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
