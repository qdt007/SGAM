import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@iconify/react';
import { Modal } from '../ui/Modal';
import { InlineError } from '../ui/States';
import { tasksApi } from '../../api/tasksApi';
import { Task } from '../../types';
import { taskFormSchema, TaskFormValues } from './taskForm';
import { TaskFormFields } from './TaskFormFields';

export function CreateTaskModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { status: 'TODO', priority: 'MEDIUM', assigneeId: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
  });

  const onSubmit = (data: TaskFormValues) => {
    mutation.mutate({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
      // The select uses '' for "nobody"; the API wants null.
      assigneeId: data.assigneeId ? data.assigneeId : null,
    });
  };

  const error = mutation.error
    ? ((mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Something went wrong')
    : null;

  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <InlineError message={error} />
        <TaskFormFields register={register} watch={watch} setValue={setValue} errors={errors} idPrefix="create-task" projectId={projectId} />
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary btn-sm">
            {isSubmitting && <Icon icon="ph:circle-notch" width={14} className="animate-spin" aria-hidden />}
            Create task
          </button>
        </div>
      </form>
    </Modal>
  );
}
