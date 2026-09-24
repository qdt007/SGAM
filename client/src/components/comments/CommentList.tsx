import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '../../api/commentsApi';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { formatRelative } from '../../utils/dateUtils';
import { keys } from '../../constants/queryKeys';
import { Comment } from '../../types';
import { cn } from '../../utils/cn';
import { CommentEditor } from './CommentEditor';

/** Renders @handles as highlighted chips without dangerouslySetInnerHTML. */
function CommentBody({ body }: { body: string }) {
  return (
    <p className="text-sm text-ink whitespace-pre-wrap break-words leading-relaxed">
      {body.split(/(@[a-zA-Z0-9_]+)/g).map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export function CommentList({ taskId, canComment = true }: { taskId: string; canComment?: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { on, off } = useSocket();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: keys.tasks.comments(taskId),
    queryFn: () => commentsApi.listByTask(taskId),
  });

  // Someone else commenting on this task should show up without a refresh.
  useEffect(() => {
    const handler = (payload: unknown) => {
      if ((payload as Comment)?.taskId === taskId) {
        queryClient.invalidateQueries({ queryKey: keys.tasks.comments(taskId) });
      }
    };
    on('comment:created', handler);
    return () => off('comment:created', handler);
  }, [on, off, taskId, queryClient]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys.tasks.comments(taskId) });
    queryClient.invalidateQueries({ queryKey: keys.tasks.detail(taskId) });
  };

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (body: string) => commentsApi.create(taskId, body),
    onSuccess: invalidate,
  });

  const { mutate: update } = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => commentsApi.update(id, body),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => commentsApi.delete(id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon icon="ph:chat-circle-dots-duotone" width={18} className="text-ink-muted" />
        <h3 className="text-sm font-semibold text-ink">
          Comments {comments.length > 0 && <span className="text-ink-muted font-normal">({comments.length})</span>}
        </h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-ink-muted">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const isMine = c.authorId === user?.id;
            return (
              <div key={c.id} className="group flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {c.author?.displayName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ink">{c.author?.displayName}</span>
                    <span className="text-xs text-ink-muted">{formatRelative(c.createdAt)}</span>
                    {c.editedAt && <span className="text-xs text-ink-muted italic">edited</span>}
                    {isMine && editingId !== c.id && (
                      <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingId(c.id)}
                          className="text-ink-muted hover:text-primary"
                          aria-label="Edit comment"
                        >
                          <Icon icon="ph:pencil-simple" width={14} />
                        </button>
                        <button
                          onClick={() => remove(c.id)}
                          className="text-ink-muted hover:text-red-500"
                          aria-label="Delete comment"
                        >
                          <Icon icon="ph:trash" width={14} />
                        </button>
                      </span>
                    )}
                  </div>

                  {editingId === c.id ? (
                    <div className="mt-2">
                      <CommentEditor
                        initialValue={c.body}
                        submitLabel="Save"
                        autoFocus
                        onCancel={() => setEditingId(null)}
                        onSubmit={(body) => update({ id: c.id, body })}
                      />
                    </div>
                  ) : (
                    <div className={cn('mt-1 rounded-xl px-3.5 py-2.5', 'bg-black/[0.03]')}>
                      <CommentBody body={c.body} />
                      {!!c.files?.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {c.files.map((f) => (
                            <a
                              key={f.id}
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <Icon icon="ph:paperclip" width={12} />
                              {f.originalName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canComment && <CommentEditor onSubmit={(body) => create(body)} isPending={isCreating} />}
    </div>
  );
}
