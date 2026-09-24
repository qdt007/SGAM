-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskAssigned" BOOLEAN NOT NULL DEFAULT true,
    "taskUpdated" BOOLEAN NOT NULL DEFAULT true,
    "taskCommented" BOOLEAN NOT NULL DEFAULT true,
    "mentioned" BOOLEAN NOT NULL DEFAULT true,
    "deadlineApproaching" BOOLEAN NOT NULL DEFAULT true,
    "projectInvite" BOOLEAN NOT NULL DEFAULT true,
    "fileUploaded" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
