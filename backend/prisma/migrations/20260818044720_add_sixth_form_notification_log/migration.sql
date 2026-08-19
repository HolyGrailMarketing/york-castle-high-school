-- CreateTable
CREATE TABLE "SixthFormNotification" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentBy" TEXT,

    CONSTRAINT "SixthFormNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SixthFormNotification_applicationId_idx" ON "SixthFormNotification"("applicationId");

-- CreateIndex
CREATE INDEX "SixthFormNotification_type_idx" ON "SixthFormNotification"("type");

-- AddForeignKey
ALTER TABLE "SixthFormNotification" ADD CONSTRAINT "SixthFormNotification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SixthFormApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
