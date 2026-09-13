-- CreateEnum
CREATE TYPE "TimetableStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "TimetableVersion" (
    "id" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "TimetableStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "sourceFile" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetablePeriod" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "altStart" TEXT,
    "altEnd" TEXT,
    "kind" TEXT NOT NULL,
    "lunchSitting" INTEGER,
    "unused" BOOLEAN NOT NULL DEFAULT false,
    "sourceLabel" TEXT,

    CONSTRAINT "TimetablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableGroup" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearName" TEXT NOT NULL,
    "undivided" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TimetableGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTeacher" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT,

    CONSTRAINT "TimetableTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableRoom" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TimetableRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableActivity" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceId" TEXT,
    "subject" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "staffOnly" BOOLEAN NOT NULL DEFAULT false,
    "room" TEXT,
    "teacherNames" TEXT[],
    "groupNames" TEXT[],

    CONSTRAINT "TimetableActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetablePlacement" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetablePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableVersion_schoolYear_idx" ON "TimetableVersion"("schoolYear");

-- CreateIndex
CREATE INDEX "TimetableVersion_status_idx" ON "TimetableVersion"("status");

-- CreateIndex
CREATE INDEX "TimetableVersion_schoolYear_status_idx" ON "TimetableVersion"("schoolYear", "status");

-- CreateIndex
CREATE INDEX "TimetablePeriod_versionId_sortOrder_idx" ON "TimetablePeriod"("versionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePeriod_versionId_key_key" ON "TimetablePeriod"("versionId", "key");

-- CreateIndex
CREATE INDEX "TimetableGroup_versionId_yearName_idx" ON "TimetableGroup"("versionId", "yearName");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableGroup_versionId_name_key" ON "TimetableGroup"("versionId", "name");

-- CreateIndex
CREATE INDEX "TimetableTeacher_teacherId_idx" ON "TimetableTeacher"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTeacher_versionId_name_key" ON "TimetableTeacher"("versionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableRoom_versionId_name_key" ON "TimetableRoom"("versionId", "name");

-- CreateIndex
CREATE INDEX "TimetableActivity_versionId_idx" ON "TimetableActivity"("versionId");

-- CreateIndex
CREATE INDEX "TimetableActivity_versionId_staffOnly_idx" ON "TimetableActivity"("versionId", "staffOnly");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePlacement_activityId_key" ON "TimetablePlacement"("activityId");

-- CreateIndex
CREATE INDEX "TimetablePlacement_versionId_day_periodKey_idx" ON "TimetablePlacement"("versionId", "day", "periodKey");

-- AddForeignKey
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableGroup" ADD CONSTRAINT "TimetableGroup_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTeacher" ADD CONSTRAINT "TimetableTeacher_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTeacher" ADD CONSTRAINT "TimetableTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableRoom" ADD CONSTRAINT "TimetableRoom_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableActivity" ADD CONSTRAINT "TimetableActivity_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "TimetableVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetablePlacement" ADD CONSTRAINT "TimetablePlacement_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TimetableActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

