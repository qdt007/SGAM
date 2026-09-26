import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, AdminUser } from '../../api/adminApi';
import { Page, PageHeader, Section, StatTile } from '../../components/ui/Page';
import { EmptyState, ErrorState, InlineError, Skeleton } from '../../components/ui/States';
import { SelectField, SelectOption } from '../../components/ui/SelectField';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { SignupChart } from '../../components/admin/SignupChart';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../utils/dateUtils';
import { GlobalRole } from '../../types';
import { cn } from '../../utils/cn';

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'USER', label: 'User', iconifyIcon: 'ph:user-duotone', iconColor: 'text-ink-muted' },
  { value: 'ADMIN', label: 'Admin', iconifyIcon: 'ph:shield-star-duotone', iconColor: 'text-primary' },
];

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

export function AdminPage() {
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [pendingDisable, setPendingDisable] = useState<AdminUser | null>(null);

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  const users = useQuery({
    queryKey: ['admin', 'users', search, page],
    queryFn: () => adminApi.users(search, page),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { globalRole?: GlobalRole; isActive?: boolean } }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => setError(apiMessage(e, 'Could not update that account')),
  });

  const s = stats.data;
  const rows = users.data?.data ?? [];
  const meta = users.data?.meta;

  if (stats.isError) {
    return (
      <Page>
        <ErrorState title="Could not load the admin data" description="Try again in a moment." />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Admin"
        description="Nhìn tổng thể hệ thống và quản lý tài khoản người dùng."
        meta={
          s && (
            <span className="text-sm text-ink-muted">
              {s.users.admins} quản trị viên · {s.users.active}/{s.users.total} tài khoản đang hoạt động
            </span>
          )
        }
      />

      <InlineError message={error} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <StatTile
              label="Người dùng"
              value={s!.users.total}
              hint={`+${s!.users.newThisWeek} trong 7 ngày`}
              icon="ph:users-three-duotone"
            />
            <StatTile label="Dự án" value={s!.projects.total} icon="ph:folders-duotone" />
            <StatTile
              label="Công việc"
              value={s!.tasks.total}
              hint={`${s!.tasks.done} xong · ${s!.tasks.overdue} trễ hạn`}
              icon="ph:check-square-duotone"
              tone={s!.tasks.overdue > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              label="Doanh thu"
              value={vnd(s!.billing.revenue)}
              hint={`${s!.billing.proSubscriptions} gói Pro đang chạy`}
              icon="ph:currency-circle-dollar-duotone"
              tone="success"
            />
          </>
        )}
      </div>

      <Section title="Đăng ký theo ngày" description="14 ngày gần nhất.">
        <div className="card-flush p-4">
          {stats.isLoading ? <Skeleton className="h-40 w-full" /> : <SignupChart data={s!.signupSeries} />}
        </div>
      </Section>

      <Section
        title="Tài khoản"
        description="Đổi quyền hoặc tạm khoá. Bạn không thể tự thao tác lên tài khoản của chính mình."
        actions={
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên, @username hoặc email"
            className="input w-64 py-2 text-sm"
          />
        }
      >
        <div className="card-flush overflow-hidden">
          {users.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="Không tìm thấy tài khoản nào" description="Thử một từ khoá khác." />
          ) : (
            rows.map((u) => {
              const isMe = u.id === meId;
              return (
                <div key={u.id} className="list-row group">
                  <Avatar name={u.displayName} src={u.avatarUrl} size="md" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {u.displayName}
                      {isMe && <span className="font-normal text-ink-muted"> (bạn)</span>}
                      {!u.isActive && (
                        <span className="badge ml-2 bg-danger/10 text-xs text-danger">Đã khoá</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {u.email} · @{u.username}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right lg:block">
                    <p className="text-xs text-ink-muted">
                      {u._count.projectMemberships} dự án · {u._count.assignedTasks} việc
                    </p>
                    <p className="text-2xs text-ink-subtle">Tham gia {formatDate(u.createdAt)}</p>
                  </div>

                  <span
                    className={cn(
                      'badge hidden shrink-0 text-xs sm:inline-flex',
                      u.subscription?.tier === 'PRO' ? 'bg-primary/10 text-primary' : 'bg-ink/[0.05] text-ink-muted',
                    )}
                  >
                    {u.subscription?.tier ?? 'FREE'}
                  </span>

                  {/* Acting on yourself is refused by the API too; disabling here just explains why. */}
                  <SelectField
                    size="sm"
                    value={u.globalRole}
                    onChange={(v) => update.mutate({ id: u.id, data: { globalRole: v as GlobalRole } })}
                    options={ROLE_OPTIONS}
                    className={cn('w-28 shrink-0', isMe && 'pointer-events-none opacity-45')}
                  />

                  <button
                    onClick={() =>
                      u.isActive ? setPendingDisable(u) : update.mutate({ id: u.id, data: { isActive: true } })
                    }
                    disabled={isMe || update.isPending}
                    title={isMe ? 'Không thể khoá tài khoản của chính bạn' : u.isActive ? 'Khoá tài khoản' : 'Mở khoá'}
                    className={cn('btn-icon-sm shrink-0', u.isActive ? 'btn-quiet-danger' : 'btn-ghost')}
                    aria-label={u.isActive ? `Khoá ${u.displayName}` : `Mở khoá ${u.displayName}`}
                  >
                    <Icon icon={u.isActive ? 'ph:prohibit-duotone' : 'ph:check-circle-duotone'} width={16} aria-hidden />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-ink-muted">
              Trang {meta.page}/{meta.totalPages} · {meta.total} tài khoản
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="btn-secondary btn-sm">
                Trước
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.totalPages}
                className="btn-secondary btn-sm"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </Section>

      {pendingDisable && (
        <ConfirmDialog
          title={`Khoá tài khoản ${pendingDisable.displayName}?`}
          message="Họ sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập lại được cho tới khi bạn mở khoá. Dữ liệu của họ được giữ nguyên."
          confirmLabel="Khoá tài khoản"
          loading={update.isPending}
          onConfirm={() => {
            update.mutate({ id: pendingDisable.id, data: { isActive: false } });
            setPendingDisable(null);
          }}
          onClose={() => setPendingDisable(null)}
        />
      )}
    </Page>
  );
}
