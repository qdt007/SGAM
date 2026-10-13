-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_UPDATED';

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "projectUpdated" BOOLEAN NOT NULL DEFAULT true;
