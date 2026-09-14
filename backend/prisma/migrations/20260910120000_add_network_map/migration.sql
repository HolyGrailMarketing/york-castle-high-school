-- CreateEnum
CREATE TYPE "NetworkPortStatus" AS ENUM ('USED', 'FREE', 'UPLINK', 'TRUNK', 'AP', 'UNKNOWN');

-- CreateTable
CREATE TABLE "NetworkDevice" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "roomLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "photoVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPort" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "connector" TEXT NOT NULL,
    "status" "NetworkPortStatus" NOT NULL DEFAULT 'UNKNOWN',
    "connection" TEXT,
    "note" TEXT,
    "sourceStatus" "NetworkPortStatus" NOT NULL,
    "sourceConnection" TEXT,
    "sourceNote" TEXT,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkPort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkDevice_slug_key" ON "NetworkDevice"("slug");

-- CreateIndex
CREATE INDEX "NetworkDevice_roomKey_sortOrder_idx" ON "NetworkDevice"("roomKey", "sortOrder");

-- CreateIndex
CREATE INDEX "NetworkPort_deviceId_idx" ON "NetworkPort"("deviceId");

-- CreateIndex
CREATE INDEX "NetworkPort_status_idx" ON "NetworkPort"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPort_deviceId_position_key" ON "NetworkPort"("deviceId", "position");

-- AddForeignKey
ALTER TABLE "NetworkPort" ADD CONSTRAINT "NetworkPort_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "NetworkDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
