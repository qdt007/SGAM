import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messagesApi, Message } from '../../api/messagesApi';
import { projectsApi } from '../../api/projectsApi';
import { Avatar } from '../ui/Avatar';
import { EmptyState, InlineError, Skeleton } from '../ui/States';
import { ConfirmDialog } from '../ui/Modal';
import { useAuthStore } from '../../stores/authStore';
import { useMentions, MentionPerson } from '../../hooks/useMentions';
import { MentionSuggestions } from '../ui/MentionSuggestions';
import { keys } from '../../constants/queryKeys';
import { formatRelative } from '../../utils/dateUtils';
import { cn } from '../../utils/cn';

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** Renders @handle runs differently from the rest of the line, without parsing HTML. */
function MessageBody({ body, highlight }: { body: string; highlight: Set<string> }) {
  // Split on the handle pattern rather than replacing into HTML — a message body is user input
  // and must never reach the DOM as markup.
  const parts = body.split(/(@[a-zA-Z0-9_]+)/g);
  return (
    <p className="text-small whitespace-pre-wrap break-words text-ink">
      {parts.map((part, i) =>
        part.startsWith('@') && highlight.has(part.slice(1)) ? (
          <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function MessageRow({
  message,
  mine,
  canModerate,
  handles,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  message: Message;
  mine: boolean;
  canModerate: boolean;
  handles: Set<string>;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
  onTogglePin: (m: Message) => void;
}) {
  return (
    <div className={cn('group flex gap-2.5 px-4 py-2 hover:bg-sunken/60', message.pinned && 'bg-primary/[0.04]')}>
      <Avatar name={message.author.displayName} src={message.author.avatarUrl} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-small font-medium text-ink">{message.author.displayName}</span>
          <span className="text-caption text-ink-subtle">{formatRelative(message.createdAt)}</span>
          {message.editedAt && <span className="text-caption text-ink-subtle">(đã sửa)</span>}
          {message.pinned && (
            <span className="badge bg-primary/10 text-caption text-primary">
              <Icon icon="ph:push-pin-duotone" width={11} aria-hidden /> Thông báo
            </span>
          )}
        </div>
        <MessageBody body={message.body} highlight={handles} />
      </div>

      {/* `row-action` is visible by default and only fades on devices that can hover — the same
          rule the task rows use, after the icons shipped invisible once. */}
      <div className="row-action flex shrink-0 items-start gap-0.5">
        {canModerate && (
          <button
            onClick={() => onTogglePin(message)}
            className="btn-ghost btn-icon-sm"
            title={message.pinned ? 'Bỏ ghim' : 'Ghim làm thông báo'}
            aria-label={message.pinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn làm thông báo'}
          >
            <Icon icon={message.pinned ? 'ph:push-pin-slash-duotone' : 'ph:push-pin-duotone'} width={14} aria-hidden />
          </button>
        )}
        {mine && (
          <button
            onClick={() => onEdit(message)}
            className="btn-ghost btn-icon-sm"
            title="Sửa"
            aria-label="Sửa tin nhắn"
          >
            <Icon icon="ph:pencil-simple-duotone" width={14} aria-hidden />
          </button>
        )}
        {(mine || canModerate) && (
          <button
            onClick={() => onDelete(message)}
            className="btn-quiet-danger btn-icon-sm"
            title="Xoá"
            aria-label="Xoá tin nhắn"
          >
            <Icon icon="ph:trash-duotone" width={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export function ProjectChat({ projectId, canPost, canModerate }: { projectId: string; canPost: boolean; canModerate: boolean }) {
  const qc = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const [draft, setDraft] = useState('');
  const [announce, setAnnounce] = useState(false);
  const [editing, setEditing] = useState<Message | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Message | null>(null);
  const [error, setError] = useState('');
  const [olderPages, setOlderPages] = useState<Message[]>([]);

  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const page = useQuery({
    queryKey: keys.projects.messages(projectId),
    queryFn: () => messagesApi.list(projectId),
  });

  // Only members can be mentioned, so only their handles are worth highlighting.
  const members = useQuery({
    queryKey: keys.projects.members(projectId),
    queryFn: () => projectsApi.getMembers(projectId),
  });
  // `user` is optional on the membership type, so a row without it is skipped rather than
  // highlighting the literal string "undefined" — and the picker would otherwise offer a blank.
  const mentionable: MentionPerson[] = (members.data ?? [])
    .filter((m) => !!m.user)
    .map((m) => ({
      id: m.user!.id,
      username: m.user!.username,
      displayName: m.user!.displayName,
      avatarUrl: m.user!.avatarUrl,
    }));
  const handles = new Set(mentionable.map((p) => p.username));

  const { results, isOpen, handleTextChange, selectMention, closeMentions } = useMentions(mentionable);
  const [highlighted, setHighlighted] = useState(0);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setHighlighted(0), [results]);

  const applyMention = (index: number) => {
    const person = results[index];
    if (!person) return;
    const { newText, newCursor } = selectMention(person, draft);
    setDraft(newText);
    requestAnimationFrame(() => {
      draftRef.current?.focus();
      draftRef.current?.setSelectionRange(newCursor, newCursor);
    });
  };

  const latest = page.data?.messages ?? [];
  const all = [...olderPages, ...latest];

  const send = useMutation({
    mutationFn: () => messagesApi.send(projectId, draft.trim(), announce),
    onSuccess: () => {
      setDraft('');
      setAnnounce(false);
      setError('');
      atBottom.current = true;
      qc.invalidateQueries({ queryKey: keys.projects.messages(projectId) });
      qc.invalidateQueries({ queryKey: keys.projects.pinnedMessages(projectId) });
    },
    onError: (e) => setError(apiMessage(e, 'Không gửi được tin nhắn')),
  });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => messagesApi.update(id, { body }),
    onSuccess: () => {
      setEditing(null);
      setError('');
      qc.invalidateQueries({ queryKey: keys.projects.messages(projectId) });
    },
    onError: (e) => setError(apiMessage(e, 'Không sửa được tin nhắn')),
  });

  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => messagesApi.update(id, { pinned }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.projects.messages(projectId) });
      qc.invalidateQueries({ queryKey: keys.projects.pinnedMessages(projectId) });
    },
    onError: (e) => setError(apiMessage(e, 'Không ghim được tin nhắn')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => messagesApi.remove(id),
    onSuccess: () => {
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: keys.projects.messages(projectId) });
      qc.invalidateQueries({ queryKey: keys.projects.pinnedMessages(projectId) });
    },
    onError: (e) => setError(apiMessage(e, 'Không xoá được tin nhắn')),
  });

  const loadOlder = useMutation({
    mutationFn: () => messagesApi.list(projectId, all[0]?.id),
    onSuccess: (older) => setOlderPages((prev) => [...older.messages, ...prev]),
    onError: (e) => setError(apiMessage(e, 'Không tải được tin nhắn cũ')),
  });

  /** Remembers whether the reader was at the bottom before new messages arrived. */
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Jump to the newest message, but only when the reader was already there. Scrolling someone
  // away from the older message they were reading is worse than them missing a line.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [all.length]);

  // A new project means a new conversation; the older pages belong to the one we just left.
  useEffect(() => setOlderPages([]), [projectId]);

  const canSend = draft.trim().length > 0 && !send.isPending;

  return (
    <div className="card-flush flex h-[min(70vh,640px)] flex-col overflow-hidden">
      <InlineError message={error} />

      <div ref={scroller} onScroll={onScroll} className="flex-1 divide-y divide-line/60 overflow-y-auto">
        {page.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <EmptyState
            title="Chưa có tin nhắn nào"
            description="Gửi tin đầu tiên để cả nhóm theo được tiến độ. Gõ @tên để nhắc một thành viên."
          />
        ) : (
          <>
            {(page.data?.hasMore || olderPages.length > 0) && (
              <div className="flex justify-center p-2">
                <button
                  onClick={() => loadOlder.mutate()}
                  disabled={loadOlder.isPending}
                  className="btn-secondary btn-xs"
                >
                  {loadOlder.isPending ? 'Đang tải…' : 'Xem tin cũ hơn'}
                </button>
              </div>
            )}
            {all.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                mine={m.authorId === myId}
                canModerate={canModerate}
                handles={handles}
                onEdit={setEditing}
                onDelete={setPendingDelete}
                onTogglePin={(msg) => pin.mutate({ id: msg.id, pinned: !msg.pinned })}
              />
            ))}
          </>
        )}
      </div>

      {canPost ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send.mutate();
          }}
          className="border-t border-line bg-surface p-3"
        >
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              {isOpen && (
                <MentionSuggestions
                  people={results}
                  highlighted={highlighted}
                  onHighlight={setHighlighted}
                  onPick={applyMention}
                  className="absolute bottom-full left-0 mb-2"
                />
              )}
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  handleTextChange(e.target.value, e.target.selectionStart);
                }}
                onBlur={closeMentions}
                onKeyDown={(e) => {
                  // While the picker is open it owns the arrows and Enter. Sending on Enter here
                  // would fire the message instead of choosing the person being pointed at.
                  if (isOpen && results.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlighted((h) => (h + 1) % results.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlighted((h) => (h - 1 + results.length) % results.length);
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      applyMention(highlighted);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      closeMentions();
                      return;
                    }
                  }
                  // Enter sends, Shift+Enter makes a new line — what every chat does.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) send.mutate();
                  }
                }}
                rows={2}
                placeholder="Viết tin nhắn… gõ @ để nhắc ai đó"
                className="input max-h-32 min-h-[44px] w-full resize-y py-2 text-sm"
                aria-label="Nội dung tin nhắn"
              />
            </div>
            <button type="submit" disabled={!canSend} className="btn-primary btn-icon" aria-label="Gửi tin nhắn">
              <Icon
                icon={send.isPending ? 'ph:circle-notch' : 'ph:paper-plane-tilt-duotone'}
                width={18}
                className={cn(send.isPending && 'animate-spin')}
                aria-hidden
              />
            </button>
          </div>

          {canModerate && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-caption text-ink-muted">
              <input
                type="checkbox"
                checked={announce}
                onChange={(e) => setAnnounce(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line accent-primary"
              />
              <Icon icon="ph:megaphone-duotone" width={13} aria-hidden />
              Ghim làm thông báo quan trọng — mọi thành viên sẽ nhận thông báo và email
            </label>
          )}
        </form>
      ) : (
        <div className="border-t border-line bg-sunken px-4 py-3 text-caption text-ink-muted">
          Bạn đang xem dự án này với quyền chỉ đọc, nên không gửi được tin nhắn.
        </div>
      )}

      {editing && (
        <EditMessageDialog
          message={editing}
          loading={edit.isPending}
          onSave={(body) => edit.mutate({ id: editing.id, body })}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Xoá tin nhắn này?"
          message="Tin nhắn sẽ biến mất với mọi thành viên. Không hoàn lại được."
          confirmLabel="Xoá"
          loading={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete.id)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function EditMessageDialog({
  message,
  loading,
  onSave,
  onClose,
}: {
  message: Message;
  loading: boolean;
  onSave: (body: string) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState(message.body);
  return (
    <ConfirmDialog
      title="Sửa tin nhắn"
      message={
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="input w-full resize-y py-2 text-sm"
          aria-label="Nội dung tin nhắn"
        />
      }
      confirmLabel="Lưu"
      loading={loading}
      onConfirm={() => body.trim() && onSave(body.trim())}
      onClose={onClose}
    />
  );
}
