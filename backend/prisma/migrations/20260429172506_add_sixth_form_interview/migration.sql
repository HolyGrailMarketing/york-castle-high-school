-- CreateTable
CREATE TABLE "SixthFormInterview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "fullyMatriculated" BOOLEAN NOT NULL DEFAULT false,
    "awarenessMotivation" INTEGER,
    "knowledgeOfSchool" INTEGER,
    "appearance" INTEGER,
    "generalSuitability" INTEGER,
    "comments" TEXT,
    "decision" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SixthFormInterview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SixthFormInterview_applicationId_key" ON "SixthFormInterview"("applicationId");

-- CreateIndex
CREATE INDEX "SixthFormInterview_applicationId_idx" ON "SixthFormInterview"("applicationId");

-- AddForeignKey
ALTER TABLE "SixthFormInterview" ADD CONSTRAINT "SixthFormInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SixthFormApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
