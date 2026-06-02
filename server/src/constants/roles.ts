import { GlobalRole, ProjectRole } from '@prisma/client';
export { GlobalRole, ProjectRole };
export const PROJECT_WRITE_ROLES: ProjectRole[] = [ProjectRole.OWNER, ProjectRole.MANAGER];
export const PROJECT_READ_ROLES: ProjectRole[] = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];
