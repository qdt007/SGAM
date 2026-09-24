import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { limitsFor, PLANS } from '../constants/plans';
import { resolveTier } from '../modules/billing/billing.service';

/**
 * Plan enforcement. Every rule lives here rather than inside feature services,
 * so the answer to "what does Free actually block?" is one file.
 *
 * All of these return 402 Payment Required with a machine-readable body, which
 * is what the client uses to show the upgrade prompt instead of a generic error.
 */

function planBlocked(res: Response, reason: string, detail: Record<string, unknown> = {}) {
  res.status(402).json({
    success: false,
    message: reason,
    code: 'PLAN_LIMIT',
    upgradeTo: 'PRO',
    ...detail,
  });
}

/** Gates a whole feature that Free does not include. */
export function requirePro(feature: 'reports' | 'gantt') {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const tier = await resolveTier(req.user!.userId);
    if (limitsFor(tier)[feature]) return next();
    planBlocked(res, `${feature === 'reports' ? 'Reports are' : 'The timeline is'} part of the Pro plan`, {
      feature,
      priceMonthly: PLANS.PRO.priceMonthly,
      priceYearly: PLANS.PRO.priceYearly,
    });
  });
}

/** Caps how many projects a Free user may own. Existing projects are untouched. */
export const enforceProjectQuota = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const tier = await resolveTier(req.user!.userId);
    const max = limitsFor(tier).maxOwnedProjects;
    if (max === null) return next();

    const owned = await prisma.projectMember.count({ where: { userId: req.user!.userId, role: 'OWNER' } });
    if (owned < max) return next();
    planBlocked(res, `The Free plan covers ${max} projects. Upgrade to Pro for unlimited projects.`, {
      feature: 'projects',
      limit: max,
      current: owned,
    });
  },
);

/** Caps project size for Free owners. Checked against the project being edited. */
export const enforceMemberQuota = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) return next();

    // The owner's plan governs the project, not the plan of whoever clicks add.
    const owner = await prisma.projectMember.findFirst({
      where: { projectId, role: 'OWNER' },
      select: { userId: true },
    });
    if (!owner) return next();

    const tier = await resolveTier(owner.userId);
    const max = limitsFor(tier).maxMembersPerProject;
    if (max === null) return next();

    const count = await prisma.projectMember.count({ where: { projectId } });
    if (count < max) return next();
    planBlocked(res, `This project is on the Free plan, which allows ${max} members.`, {
      feature: 'members',
      limit: max,
      current: count,
    });
  },
);

/** Upload ceiling, applied after multer has parsed the files. */
export const enforceUploadQuota = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return next();

    const tier = await resolveTier(req.user!.userId);
    const maxMb = limitsFor(tier).maxUploadMb;
    const tooBig = files.find((f) => f.size > maxMb * 1024 * 1024);
    if (!tooBig) return next();

    planBlocked(res, `The ${tier === 'FREE' ? 'Free' : 'Pro'} plan allows files up to ${maxMb}MB.`, {
      feature: 'upload',
      limitMb: maxMb,
      fileName: tooBig.originalname,
    });
  },
);
