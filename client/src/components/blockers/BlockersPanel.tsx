import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blockersApi, Blocker, IMPACT_META } from '../../api/blockersApi';
import { tasksApi } from '../../api/tasksApi';
import { Avatar } from '../ui/Avatar';
import { Modal, ConfirmDialog } from '../ui/Modal';
import { SelectField, SelectOption } from '../ui/SelectField';
import { EmptyState, InlineError, Skeleton } from '../ui/States';
import { StatTile } from '../ui/Page';
import { keys } from '../../constants/queryKeys';
import { formatRelative } from '../../utils/dateUtils';
import { BlockerImpact } from '../../types';
import { cn } from '../../utils/cn';

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const IMPACT_OPTIONS: SelectOption[] = (['BLOCKING', 'SERIOUS', 'MINOR'] as BlockerImpact[]).map((impact) => ({
  value: impact,
  label: IMPACT_META[impact].label,
  iconifyIcon: IMPACT_META[impact].icon,
}));

function BlockerCard({
  blocker,
  canWrite,
  canDelete,
  onResolve,
  onReopen,
  onDelete,
}: {
  blocker: Blocker;
  canWrite: boolean;
  canDelete: boolean;
  onResolve: (b: Blocker) => void;
  onReopen: (b: Blocker) => void;
  onDelete: (b: Blocker) => void;
}) {
  const meta = IMPACT_META[blocker.impact];
  const resolved = blocker.status === 'RESOLVED';

  return (
    <div className={cn('group p-4', resolved && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <Icon
          icon={resolved ? 'ph:check-circle-duotone' : meta.icon}
          width={20}
          className={cn('mt-0.5 shrink-0', resolved ? 'text-success' : blocker.impact === 'BLOCKING' ? 'text-danger' : 'text-warning')}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className={cn('text-small font-medium text-ink', resolved && 'line-through')}>{blocker.title}</h4>
            <span className={cn('badge text-caption', resolved ? 'bg-success/10 text-success' : meta.badge)}>
              {resolved ? 'Đã xử lý' : meta.label}
            </span>
          </div>

          {blocker.description && (
            <p className="mt-1 whitespace-pre-wrap text-caption text-ink-muted">{blocker.description}</p>
          )}

          {blocker.task && (
            <Link
              to={`/projects/${blocker.projectId}?task=${blocker.task.id}`}
              className="mt-1.5 inline-flex items-center gap-1 text-caption text-primary hover:underline"
            >
              <Icon icon="ph:check-square-duotone" width={12} aria-hidden />
              {blocker.task.title}
            </Link>
          )}

          {resolved && blocker.resolution && (
            <div className="mt-2 rounded-lg border border-success/20 bg-success/[0.06] px-2.5 py-2">
              <p className="text-caption text-ink">
                <span className="font-medium">Cách xử lý: </span>
                {blocker.resolution}
              </p>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={blocker.raisedBy.displayName} src={blocker.raisedBy.avatarUrl} size="xs" />
              {blocker.raisedBy.displayName} nêu {formatRelative(blocker.createdAt)}
            </span>
            {resolved && blocker.resolvedBy && (
              <span>
                · {blocker.resolvedBy.displayName} xử lý {blocker.resolvedAt ? formatRelative(blocker.resolvedAt) : ''}
              </span>
            )}
          </div>
        </div>

        <div className="row-action flex shrink-0 items-start gap-0.5">
          {canWrite && !resolved && (
            <button
              onClick={() => onResolve(blocker)}
              className="btn-ghost btn-icon-sm"
              title="Đánh dấu đã xử lý"
              aria-label={`Đánh dấu đã xử lý: ${blocker.title}`}
            >
              <Icon icon="ph:check-circle-duotone" width={15} aria-hidden />
            </button>
          )}
          {canWrite && resolved && (
            <button
              onClick={() => onReopen(blocker)}
              className="btn-ghost btn-icon-sm"
              title="Mở lại"
              aria-label={`Mở lại: ${blocker.title}`}
            >
              <Icon icon="ph:arrow-counter-clockwise-duotone" width={15} aria-hidden />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(blocker)}
              className="btn-quiet-danger btn-icon-sm"
              title="Xoá"
              aria-label={`Xoá: ${blocker.title}`}
            >
              <Icon icon="ph:trash-duotone" width={15} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BlockersPanel({
  projectId,
  canWrite,
  canDelete,
}: {
  projectId: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [resolving, setResolving] = useState<Blocker | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Blocker | null>(null);
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: keys.projects.blockers(projectId),
    queryFn: () => blockersApi.list(projectId),
  });

  const invalidate = () => {
    setError('');
    qc.invalidateQueries({ queryKey: keys.projects.blockers(projectId) });
  };

  const resolve = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution?: string }) => blockersApi.resolve(id, resolution),
    onSuccess: () => {
      setResolving(null);
      invalidate();
    },
    onError: (e) => setError(apiMessage(e, 'Không đánh dấu được')),
  });

  const reopen = useMutation({
    mutationFn: (id: string) => blockersApi.reopen(id),
    onSuccess: invalidate,
    onError: (e) => setError(apiMessage(e, 'Không mở lại được')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => blockersApi.remove(id),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
    },
    onError: (e) => setError(apiMessage(e, 'Không xoá được')),
  });

  const blockers = list.data?.blockers ?? [];
  const counts = list.data?.counts;

  return (
    <div className="space-y-4">
      <InlineError message={error} />

      <div className="grid gap-3 sm:grid-cols-3">
        {list.isLoading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <StatTile
              label="Đang chặn tiến độ"
              value={counts?.blocking ?? 0}
              icon="ph:warning-octagon-duotone"
              tone={counts?.blocking ? 'danger' : 'neutral'}
            />
            <StatTile label="Chưa xử lý" value={counts?.open ?? 0} icon="ph:warning-duotone" tone={counts?.open ? 'warning' : 'neutral'} />
            <StatTile label="Đã xử lý" value={counts?.resolved ?? 0} icon="ph:check-circle-duotone" tone="success" />
          </>
        )}
      </div>

      {canWrite && (
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
          <Icon icon="ph:plus" width={14} aria-hidden /> Nêu khó khăn
        </button>
      )}

      <div className="card-flush divide-y divide-line/60 overflow-hidden">
        {list.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : blockers.length === 0 ? (
          <EmptyState
            title="Chưa ghi nhận khó khăn nào"
            description="Khi nhóm bị chặn vì chờ ai đó, chờ một quyết định hay thiếu thứ gì, ghi vào đây để cả nhóm thấy."
          />
        ) : (
          blockers.map((b) => (
            <BlockerCard
              key={b.id}
              blocker={b}
              canWrite={canWrite}
              canDelete={canDelete}
              onResolve={setResolving}
              onReopen={(x) => reopen.mutate(x.id)}
              onDelete={setPendingDelete}
            />
          ))
        )}
      </div>

      {showCreate && <CreateBlockerModal projectId={projectId} onClose={() => setShowCreate(false)} onCreated={invalidate} />}

      {resolving && (
        <ResolveModal
          blocker={resolving}
          loading={resolve.isPending}
          onConfirm={(resolution) => resolve.mutate({ id: resolving.id, resolution })}
          onClose={() => setResolving(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Xoá "${pendingDelete.title}"?`}
          message="Mất luôn bản ghi về khó khăn này và cách nhóm đã xử lý nó. Nếu chỉ muốn đóng lại thì dùng 'đã xử lý'."
          confirmLabel="Xoá"
          loading={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete.id)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

function CreateBlockerModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState<BlockerImpact>('SERIOUS');
  const [taskId, setTaskId] = useState('');
  const [error, setError] = useState('');

  const tasks = useQuery({
    queryKey: keys.tasks.byProject(projectId),
    queryFn: () => tasksApi.listByProject(projectId),
  });

  // Only top-level tasks: a subtask is a checklist item inside a task, not scope of its own.
  const taskOptions: SelectOption[] = [
    { value: '', label: 'Không gắn với công việc nào' },
    ...(tasks.data ?? [])
      .filter((t) => !t.parentId)
      .map((t) => ({ value: t.id, label: t.title })),
  ];

  const create = useMutation({
    mutationFn: () =>
      blockersApi.create(projectId, {
        title: title.trim(),
        ...(description.trim() && { description: description.trim() }),
        impact,
        ...(taskId && { taskId }),
      }),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: (e) => setError(apiMessage(e, 'Không ghi được khó khăn')),
  });

  return (
    <Modal
      title="Nêu một khó khăn"
      description="Cả nhóm sẽ nhận thông báo. Nếu chọn mức Đang chặn, họ còn nhận email."
      onClose={onClose}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Huỷ
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!title.trim() || create.isPending}
            className="btn-primary btn-sm"
          >
            {create.isPending && <Icon icon="ph:circle-notch" width={14} className="animate-spin" aria-hidden />}
            Ghi lại
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <InlineError message={error} />

        <div>
          <label htmlFor="blocker-title" className="mb-1 block text-caption font-medium text-ink-muted">
            Khó khăn là gì?
          </label>
          <input
            id="blocker-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Chưa có khoá payOS nên không test được thanh toán"
            className="input w-full py-2 text-sm"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="blocker-desc" className="mb-1 block text-caption font-medium text-ink-muted">
            Chi tiết <span className="font-normal">(không bắt buộc)</span>
          </label>
          <textarea
            id="blocker-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Đang chờ ai, cần quyết định gì, đã thử cách nào…"
            className="input w-full resize-y py-2 text-sm"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-caption font-medium text-ink-muted">Mức ảnh hưởng</span>
            <SelectField value={impact} onChange={(v) => setImpact(v as BlockerImpact)} options={IMPACT_OPTIONS} />
          </div>
          <div>
            <span className="mb-1 block text-caption font-medium text-ink-muted">Gắn với công việc</span>
            <SelectField value={taskId} onChange={setTaskId} options={taskOptions} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ResolveModal({
  blocker,
  loading,
  onConfirm,
  onClose,
}: {
  blocker: Blocker;
  loading: boolean;
  onConfirm: (resolution?: string) => void;
  onClose: () => void;
}) {
  const [resolution, setResolution] = useState('');
  return (
    <Modal
      title="Đã xử lý xong?"
      description={blocker.title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Huỷ
          </button>
          <button onClick={() => onConfirm(resolution.trim() || undefined)} disabled={loading} className="btn-primary btn-sm">
            {loading && <Icon icon="ph:circle-notch" width={14} className="animate-spin" aria-hidden />}
            Đánh dấu đã xử lý
          </button>
        </>
      }
    >
      <label htmlFor="resolution" className="mb-1 block text-caption font-medium text-ink-muted">
        Đã xử lý thế nào? <span className="font-normal">(nên ghi, để lần sau khỏi mò lại)</span>
      </label>
      <textarea
        id="resolution"
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        rows={3}
        className="input w-full resize-y py-2 text-sm"
        autoFocus
      />
    </Modal>
  );
}
