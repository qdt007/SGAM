import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/projectsApi';
import { useAuthStore } from '../stores/authStore';
import { keys } from '../constants/queryKeys';
import { ProjectRole } from '../types';

const WRITE_ROLES: ProjectRole[] = ['OWNER', 'MANAGER'];

export function usePermissions(projectId: string | undefined) {
  const { user } = useAuthStore();

  const { data: members } = useQuery({
    queryKey: keys.projects.members(projectId!),
    queryFn: () => projectsApi.getMembers(projectId!),
    enabled: !!projectId,
  });

  const role = members?.find((m) => m.userId === user?.id)?.role;
  const isAdmin = user?.globalRole === 'ADMIN';

  return {
    role,
    isAdmin,
    canView: isAdmin || !!role,
    canEdit: isAdmin || (!!role && WRITE_ROLES.includes(role)),
    canDelete: isAdmin || (!!role && WRITE_ROLES.includes(role)),
    canManageMembers: isAdmin || (!!role && WRITE_ROLES.includes(role)),
    canAssign: isAdmin || (!!role && WRITE_ROLES.includes(role)),
    isOwner: isAdmin || role === 'OWNER',
  };
}
