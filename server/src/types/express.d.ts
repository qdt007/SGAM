import { ProjectMember } from '@prisma/client';
import { TokenPayload } from '../utils/jwt';
declare global {
  namespace Express {
    interface Request { user?: TokenPayload; projectMember?: ProjectMember; taskProjectId?: string; }
  }
}
