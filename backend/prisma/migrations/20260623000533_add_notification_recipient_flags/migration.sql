-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyAdmissions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyGeneralRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifySixthFormApps" BOOLEAN NOT NULL DEFAULT false;
