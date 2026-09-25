import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@iconify/react';
import { SelectField, PROJECT_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../ui/SelectField';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { projectsApi } from '../../api/projectsApi';
import { planLimitFrom } from '../../hooks/usePlan';
import { cn } from '../../utils/cn';
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
export function ProjectModal({ onClose, project }: { onClose: () => void; project?: Project }) {
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
