import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { keys } from '../../constants/queryKeys';
import { TaskTag } from '../../types';

/** Toggles which of the project's tags are on this task. The whole set is sent on every change. */
export function TaskTags({
  taskId,
  projectId,
  tags,
  canEdit,
}: {
  taskId: string;
  projectId: string;
  tags: TaskTag[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: projectTags = [] } = useQuery({
    queryKey: keys.projects.tags(projectId),
    queryFn: () => projectsApi.getTags(projectId),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = tags.map((t) => t.tagId);

  const { mutate: setTags, isPending } = useMutation({
    mutationFn: (tagIds: string[]) => tasksApi.setTags(taskId, tagIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tasks.detail(taskId) });
      qc.invalidateQueries({ queryKey: keys.tasks.byProject(projectId) });
    },
  });

  const toggle = (tagId: string) =>
    setTags(selected.includes(tagId) ? selected.filter((id) => id !== tagId) : [...selected, tagId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="ph:tag-duotone" width={18} className="text-ink-muted" />
        <h3 className="text-sm font-semibold text-ink">Tags</h3>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.tagId}
            className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: `${t.tag.color}1a`, color: t.tag.color }}
          >
            {t.tag.name}
            {canEdit && (
              <button
                onClick={() => toggle(t.tagId)}
                disabled={isPending}
                aria-label={`Remove ${t.tag.name} from this task`}
                className="row-action"
              >
                <Icon icon="ph:x-bold" width={10} aria-hidden />
              </button>
            )}
          </span>
        ))}

        {canEdit && (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setOpen((o) => !o)} className="text-xs text-primary hover:underline">
              {tags.length ? 'Edit' : '+ Add tag'}
            </button>
            {open && (
              <div className="menu absolute left-0 top-6 z-20 max-h-56 w-48 overflow-y-auto py-1">
                {projectTags.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-ink-muted">
                    This project has no tags yet. Add them in the project sidebar.
                  </p>
                ) : (
                  projectTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => toggle(t.id)}
                      disabled={isPending}
                      className="menu-item justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="truncate">{t.name}</span>
                      </span>
                      {selected.includes(t.id) && <Icon icon="ph:check-bold" width={12} aria-hidden />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
