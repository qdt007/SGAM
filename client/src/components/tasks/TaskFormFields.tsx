import { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { SelectField, STATUS_OPTIONS, PRIORITY_OPTIONS, SelectOption } from '../ui/SelectField';
import { DatePicker } from '../ui/DatePicker';
import { projectsApi } from '../../api/projectsApi';
import { keys } from '../../constants/queryKeys';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { TaskFormValues } from './taskForm';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

/** The create and edit dialogs ask for exactly the same fields — define them once. */
export function TaskFormFields({
  register,
  watch,
  setValue,
  errors,
  idPrefix,
  projectId,
}: {
  register: UseFormRegister<TaskFormValues>;
  watch: UseFormWatch<TaskFormValues>;
  setValue: UseFormSetValue<TaskFormValues>;
  errors: FieldErrors<TaskFormValues>;
  idPrefix: string;
  projectId: string;
}) {
  // Only people already on the project can be assigned — the API rejects anyone else.
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: keys.projects.members(projectId),
    queryFn: () => projectsApi.getMembers(projectId),
    enabled: !!projectId,
  });

  const assigneeOptions: SelectOption[] = [
    { value: '', label: 'Unassigned', iconifyIcon: 'ph:user-circle-dashed', iconColor: 'text-ink-subtle' },
    ...members.map((m) => ({
      value: m.userId,
      label: `${m.user?.displayName ?? m.user?.username ?? 'Unknown'} · ${ROLE_LABEL[m.role] ?? m.role}`,
      iconifyIcon: 'ph:user-circle-duotone',
    })),
  ];

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-title`} className="label">
          Task title
        </label>
        <input
          id={`${idPrefix}-title`}
          {...register('title')}
          className={cn('input', errors.title && 'input-invalid')}
          placeholder="What needs to be done?"
          aria-invalid={!!errors.title}
        />
        {errors.title && <p className="field-error">{errors.title.message}</p>}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-description`} className="label">
          Description
        </label>
        <textarea
          id={`${idPrefix}-description`}
          {...register('description')}
          className="input resize-none"
          rows={3}
          placeholder="Add context, acceptance criteria or links."
        />
      </div>

      <SelectField
        label="Assignee"
        value={watch('assigneeId') ?? ''}
        onChange={(v) => setValue('assigneeId', v, { shouldDirty: true })}
        options={assigneeOptions}
        placeholder={membersLoading ? 'Loading members…' : 'Unassigned'}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Status"
          value={watch('status') ?? 'TODO'}
          onChange={(v) => setValue('status', v as Task['status'])}
          options={STATUS_OPTIONS}
        />
        <SelectField
          label="Priority"
          value={watch('priority') ?? 'MEDIUM'}
          onChange={(v) => setValue('priority', v as Task['priority'])}
          options={PRIORITY_OPTIONS}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DatePicker
          label="Due date"
          value={watch('dueDate')}
          onChange={(iso) => setValue('dueDate', iso.slice(0, 10))}
          onClear={() => setValue('dueDate', '')}
        />
        <div>
          <label htmlFor={`${idPrefix}-estimate`} className="label">
            Estimate (hours)
          </label>
          <input
            id={`${idPrefix}-estimate`}
            type="number"
            min="0"
            step="0.5"
            {...register('estimatedHrs', {
              setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
            })}
            className={cn('input', errors.estimatedHrs && 'input-invalid')}
            placeholder="e.g. 8"
          />
          {errors.estimatedHrs && <p className="field-error">{errors.estimatedHrs.message}</p>}
        </div>
      </div>
    </>
  );
}
