import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { SelectField, PRIORITY_OPTIONS } from '../ui/SelectField';
import { tasksApi } from '../../api/tasksApi';
import { Task } from '../../types';

/* The inline board form only asks for what a card needs to exist. */
const cardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
});
type CardForm = z.infer<typeof cardSchema>;

export function AddCardForm({
  projectId,
  status,
  onClose,
}: {
  projectId: string;
  status: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CardForm>({
    resolver: zodResolver(cardSchema),
    defaultValues: { priority: 'MEDIUM' },
  });

  const mutation = useMutation({
    mutationFn: (data: CardForm) => tasksApi.create(projectId, { ...data, status: status as Task['status'] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="rounded-xl border border-primary/30 bg-raised p-3 shadow-md space-y-2"
    >
      <input {...register('title')} autoFocus placeholder="Task title..." className="input text-sm py-1.5" />
      {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
      <SelectField
        value={watch('priority') ?? 'MEDIUM'}
        onChange={(v) => setValue('priority', v as CardForm['priority'])}
        options={PRIORITY_OPTIONS}
        size="sm"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className="btn-primary text-xs py-1 flex-1 justify-center">
          {isSubmitting ? 'Adding...' : 'Add'}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost p-1">
          <X size={14} />
        </button>
      </div>
    </form>
  );
}
