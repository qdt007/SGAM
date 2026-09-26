import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projectsApi';
import { usersApi } from '../../api/usersApi';
import { useAuthStore } from '../../stores/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { keys } from '../../constants/queryKeys';
import { ProjectRole } from '../../types';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';
import { SelectField, SelectOption } from '../ui/SelectField';
import { ConfirmDialog } from '../ui/Modal';

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'OWNER', label: 'Owner', iconifyIcon: 'ph:crown-duotone', iconColor: 'text-primary' },
  { value: 'MANAGER', label: 'Manager', iconifyIcon: 'ph:shield-check-duotone', iconColor: 'text-violet-500' },
  { value: 'MEMBER', label: 'Member', iconifyIcon: 'ph:user-duotone', iconColor: 'text-emerald-500' },
  { value: 'VIEWER', label: 'Viewer', iconifyIcon: 'ph:eye-duotone', iconColor: 'text-ink-muted' },
];
const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter((o) => o.value !== 'OWNER');

const ROLE_STYLE: Record<ProjectRole, string> = {
  OWNER: 'bg-primary/10 text-primary',
  MANAGER: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  MEMBER: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  VIEWER: 'bg-black/[0.05] text-ink-muted',
};

export function ProjectMembers({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { canManageMembers } = usePermissions(projectId);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<ProjectRole>('MEMBER');
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ userId: string; name: string } | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: keys.projects.members(projectId),
    queryFn: () => projectsApi.getMembers(projectId),
  });

  const { data: results = [] } = useQuery({
    queryKey: keys.users.search(search),
    queryFn: () => usersApi.search(search),
    enabled: search.trim().length >= 2,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys.projects.members(projectId) });
    queryClient.invalidateQueries({ queryKey: keys.projects.detail(projectId) });
  };

  const { mutate: addMember } = useMutation({
    mutationFn: (userId: string) => projectsApi.addMember(projectId, userId, role),
    onSuccess: () => {
      setSearch('');
      setError(null);
      invalidate();
    },
    onError: (e: unknown) =>
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not add member',
      ),
  });

  const { mutate: changeRole } = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: ProjectRole }) =>
      projectsApi.updateMemberRole(projectId, userId, newRole),
    onSuccess: invalidate,
  });

  const { mutate: removeMember } = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(projectId, userId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: unknown) =>
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not remove member',
      ),
  });

  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = results.filter((r) => !memberIds.has(r.id));

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <Icon icon="ph:users-three-duotone" width={18} className="text-ink-muted" />
        <h2 className="text-sm font-semibold text-ink">
          Members <span className="text-ink-muted font-normal">({members.length})</span>
        </h2>
      </div>

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="group flex items-center gap-3">
            <Avatar name={m.user?.displayName} src={m.user?.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink truncate">
                {m.user?.displayName}
                {m.userId === user?.id && <span className="text-ink-muted font-normal"> (you)</span>}
              </p>
              <p className="text-xs text-ink-muted truncate">@{m.user?.username}</p>
            </div>

            {canManageMembers && m.userId !== user?.id ? (
              <SelectField
                size="sm"
                value={m.role}
                onChange={(v) => changeRole({ userId: m.userId, newRole: v as ProjectRole })}
                options={ROLE_OPTIONS}
                className="w-32 shrink-0"
              />
            ) : (
              <span className={cn('badge text-xs', ROLE_STYLE[m.role])}>{m.role}</span>
            )}

            {canManageMembers && m.userId !== user?.id && (
              <button
                onClick={() => setPendingRemoval({ userId: m.userId, name: m.user?.displayName ?? 'this member' })}
                className="row-action text-ink-muted hover:text-red-500"
                aria-label={'Remove ' + (m.user?.displayName ?? 'member')}
              >
                <Icon icon="ph:user-minus" width={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canManageMembers && (
        <div className="space-y-2 pt-1 border-t border-hairline">
          <div className="flex gap-2 pt-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people by name, @username or email"
              className="input text-sm py-2"
            />
            <SelectField
              value={role}
              onChange={(v) => setRole(v as ProjectRole)}
              options={INVITE_ROLE_OPTIONS}
              className="w-32 shrink-0"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {search.trim().length >= 2 && (
            <div className="rounded-xl border border-hairline divide-y divide-hairline-soft dark:divide-white/[0.06] overflow-hidden">
              {candidates.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-ink-muted">No matching people.</p>
              ) : (
                candidates.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addMember(u.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-black/[0.03] transition-colors"
                  >
                    <Avatar name={u.displayName} src={u.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">{u.displayName}</p>
                      <p className="text-xs text-ink-muted truncate">
                        @{u.username} · {u.email}
                      </p>
                    </div>
                    <Icon icon="ph:plus-circle-duotone" width={18} className="text-primary shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {pendingRemoval && (
        <ConfirmDialog
          title={`Remove ${pendingRemoval.name}?`}
          message="They lose access to this project immediately. Their tasks, comments and time logs stay, and you can add them back later."
          confirmLabel="Remove"
          onConfirm={() => {
            removeMember(pendingRemoval.userId);
            setPendingRemoval(null);
          }}
          onClose={() => setPendingRemoval(null)}
        />
      )}
    </div>
  );
}
