import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projectsApi';
import { usePermissions } from '../../hooks/usePermissions';
import { keys } from '../../constants/queryKeys';
import { ConfirmDialog } from '../ui/Modal';

const SWATCHES = ['#6366f1', '#0066cc', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#0891b2', '#78716c'];

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** Project-scoped tag list. Tags are global rows, so adding one that already exists reuses it. */
export function ProjectTags({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { canEdit, isOwner } = usePermissions(projectId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: tags = [] } = useQuery({
    queryKey: keys.projects.tags(projectId),
    queryFn: () => projectsApi.getTags(projectId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.projects.tags(projectId) });
    // Task payloads embed their tags, so a rename or removal has to reach the lists too.
    qc.invalidateQueries({ queryKey: keys.tasks.byProject(projectId) });
  };

  const add = useMutation({
    mutationFn: () => projectsApi.addTag(projectId, { name: name.trim(), color }),
    onSuccess: () => {
      invalidate();
      setName('');
      setAdding(false);
      setError('');
    },
    onError: (e) => setError(apiMessage(e, 'Could not add that tag')),
  });

  const remove = useMutation({ mutationFn: (tagId: string) => projectsApi.removeTag(projectId, tagId), onSuccess: invalidate });

  const submit = () => {
    if (!name.trim()) return setError('Give the tag a name.');
    add.mutate();
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <Icon icon="ph:tag-duotone" width={18} className="text-ink-muted" />
        <h2 className="text-sm font-semibold text-ink">
          Tags <span className="font-normal text-ink-muted">({tags.length})</span>
        </h2>
      </div>

      {tags.length === 0 && !adding && (
        <p className="text-xs text-ink-muted">No tags yet. Tags group tasks across boards and views.</p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t.id}
              className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${t.color}1a`, color: t.color }}
            >
              {t.name}
              {isOwner && (
                <button
                  onClick={() => setPendingDelete({ id: t.id, name: t.name })}
                  aria-label={`Remove tag ${t.name}`}
                  className="row-action"
                >
                  <Icon icon="ph:x-bold" width={10} aria-hidden />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canEdit &&
        (adding ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tag name"
              className="input w-full py-1 text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Use colour ${c}`}
                  className="h-5 w-5 rounded-full ring-offset-2 ring-offset-surface transition-shadow"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                />
              ))}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex items-center gap-2">
              <button onClick={submit} disabled={add.isPending} className="btn-primary px-3 py-1 text-sm">
                {add.isPending ? 'Adding...' : 'Add tag'}
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setError('');
                }}
                className="btn-ghost px-3 py-1 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="text-xs text-primary hover:underline">
            + Add tag
          </button>
        ))}

      {pendingDelete && (
        <ConfirmDialog
          title={`Remove the "${pendingDelete.name}" tag?`}
          message="It is taken off every task in this project. Other projects using the same tag keep it."
          confirmLabel="Remove tag"
          onConfirm={() => {
            remove.mutate(pendingDelete.id);
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
