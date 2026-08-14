-- CreateTable
CREATE TABLE "BooklistEntry" (
    "id" TEXT NOT NULL,
    "schoolYear" TEXT NOT NULL,
    "gradeLabel" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storagePath" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BooklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BooklistEntry_isPublished_sortOrder_idx" ON "BooklistEntry"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "BooklistEntry_schoolYear_idx" ON "BooklistEntry"("schoolYear");

-- CreateIndex
CREATE UNIQUE INDEX "BooklistEntry_schoolYear_gradeLabel_key" ON "BooklistEntry"("schoolYear", "gradeLabel");
