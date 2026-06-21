import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, FolderKanban, X, ArrowRight, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { projectsApi } from '../../api/projectsApi';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';
import { Project } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  PLANNING: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ON_HOLD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  COMPLETED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-600',
  HIGH: 'text-orange-500',
  MEDIUM: 'text-yellow-500',
  LOW: 'text-green-500',
};

const COVER_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'];

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  coverColor: z.string().optional(),
});
type ProjectForm = z.infer<typeof projectSchema>;

function ProjectModal({
  onClose,
  project,
}: {
  onClose: () => void;
  project?: Project;
}) {
  const qc = useQueryClient();
  const isEdit = !!project;
  const [selectedColor, setSelectedColor] = useState(project?.coverColor ?? COVER_COLORS[0]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'PLANNING',
      priority: project?.priority ?? 'MEDIUM',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Project>) =>
      isEdit ? projectsApi.update(project.id, data) : projectsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose(); },
  });

  const onSubmit = (data: ProjectForm) => mutation.mutate({ ...data, coverColor: selectedColor });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg dark:text-white">{isEdit ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mutation.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Something went wrong'}
            </div>
          )}

          <div>
            <label className="label">Project name *</label>
            <input {...register('name')} className={cn('input', errors.name && 'border-red-400')} placeholder="My awesome project" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} className="input resize-none" rows={3} placeholder="What is this project about?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Cover color</label>
            <div className="flex gap-2 flex-wrap">
              {COVER_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setSelectedColor(c)}
                  className={cn('h-7 w-7 rounded-full border-2 transition-transform', selectedColor === c ? 'border-gray-800 scale-110 dark:border-white' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
              {isSubmitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm shadow-2xl">
        <h2 className="font-semibold text-lg dark:text-white mb-1">Delete Project</h2>
        <p className="text-sm text-gray-500 mb-4">
          Are you sure you want to delete <span className="font-medium text-gray-800 dark:text-white">"{project.name}"</span>? This will also delete all tasks. This action cannot be undone.
        </p>
        {mutation.error && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete'}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 justify-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {mutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <div className="card flex flex-col hover:border-primary-300 transition-colors group relative">
        <div className="h-2 rounded-t-xl -mx-4 -mt-4 mb-4" style={{ backgroundColor: project.coverColor || '#6366f1' }} />

        {/* Action menu */}
        <div className="absolute top-3 right-3">
          <button
            onClick={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
            className="opacity-0 group-hover:opacity-100 btn-ghost p-1 rounded-lg transition-opacity"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-20 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 overflow-hidden">
                <button
                  onClick={() => { setMenuOpen(false); setShowEdit(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setShowDelete(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>

        <Link to={`/projects/${project.id}`} className="flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2 pr-6">
            <h3 className="font-semibold text-sm dark:text-white group-hover:text-primary-600 truncate">{project.name}</h3>
            <span className={cn('badge text-xs shrink-0', STATUS_COLOR[project.status])}>{project.status}</span>
          </div>
          {project.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{project.description}</p>
          )}
          <div className="mt-auto pt-3 flex items-center justify-between">
            <div className="flex gap-3 text-xs text-gray-500">
              <span>{project._count?.tasks ?? 0} tasks</span>
              <span>{project._count?.members ?? 0} members</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={cn('text-xs font-medium', PRIORITY_COLOR[project.priority])}>{project.priority}</span>
              <ArrowRight size={12} className="text-gray-400 group-hover:text-primary-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}</p>
        </Link>
      </div>

      {showEdit && <ProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showDelete && <DeleteConfirmModal project={project} onClose={() => setShowDelete(false)} />}
    </>
  );
}

export function ProjectsListPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> New Project
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="card h-40 animate-pulse bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-16">
          <FolderKanban size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="font-medium text-gray-700 dark:text-gray-300">No projects yet</h3>
          <p className="text-sm text-gray-500 mt-1">Create your first project to get started.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 inline-flex">
            <Plus size={16} /> New Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showCreate && <ProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
