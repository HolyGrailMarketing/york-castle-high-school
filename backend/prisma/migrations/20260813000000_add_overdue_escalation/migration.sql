-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "escalatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyOverdueRequests" BOOLEAN NOT NULL DEFAULT false;
