-- CreateEnum
CREATE TYPE "SnapshotBatchStatus" AS ENUM ('STAGING', 'CURRENT', 'FAILED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "PedagogicalCompanySnapshot" ADD COLUMN "batchId" TEXT;
ALTER TABLE "PedagogicalStudentSnapshot" ADD COLUMN "batchId" TEXT;
ALTER TABLE "PedagogicalSyncRun" ADD COLUMN "heartbeatAt" TIMESTAMP(3);
ALTER TABLE "PedagogicalSyncRun" ADD COLUMN "leaseToken" TEXT;

-- CreateTable
CREATE TABLE "PedagogicalSnapshotBatch" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT,
    "status" "SnapshotBatchStatus" NOT NULL DEFAULT 'STAGING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedagogicalSnapshotBatch_pkey" PRIMARY KEY ("id")
);

-- Backfill current batch for legacy snapshot rows
INSERT INTO "PedagogicalSnapshotBatch" (
    "id",
    "status",
    "startedAt",
    "publishedAt",
    "finishedAt",
    "createdAt",
    "updatedAt"
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'CURRENT',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "PedagogicalCompanySnapshot"
SET "batchId" = '00000000-0000-0000-0000-000000000001'
WHERE "batchId" IS NULL;

UPDATE "PedagogicalStudentSnapshot"
SET "batchId" = '00000000-0000-0000-0000-000000000001'
WHERE "batchId" IS NULL;

-- Make batch required after backfill
ALTER TABLE "PedagogicalCompanySnapshot" ALTER COLUMN "batchId" SET NOT NULL;
ALTER TABLE "PedagogicalStudentSnapshot" ALTER COLUMN "batchId" SET NOT NULL;

-- Drop old uniqueness on sourceId and replace with batch-aware uniqueness
DROP INDEX "PedagogicalCompanySnapshot_sourceId_key";
DROP INDEX "PedagogicalStudentSnapshot_sourceId_key";
DROP INDEX "PedagogicalCompanySnapshot_name_idx";
DROP INDEX "PedagogicalCompanySnapshot_taxId_idx";
DROP INDEX "PedagogicalStudentSnapshot_companySourceId_idx";
DROP INDEX "PedagogicalStudentSnapshot_name_idx";
DROP INDEX "PedagogicalStudentSnapshot_cpf_idx";

-- CreateIndex
CREATE UNIQUE INDEX "PedagogicalSnapshotBatch_syncRunId_key" ON "PedagogicalSnapshotBatch"("syncRunId");
CREATE INDEX "PedagogicalSnapshotBatch_status_publishedAt_idx" ON "PedagogicalSnapshotBatch"("status", "publishedAt");
CREATE INDEX "PedagogicalSyncRun_status_heartbeatAt_idx" ON "PedagogicalSyncRun"("status", "heartbeatAt");
CREATE UNIQUE INDEX "PedagogicalCompanySnapshot_batchId_sourceId_key" ON "PedagogicalCompanySnapshot"("batchId", "sourceId");
CREATE INDEX "PedagogicalCompanySnapshot_batchId_name_idx" ON "PedagogicalCompanySnapshot"("batchId", "name");
CREATE INDEX "PedagogicalCompanySnapshot_batchId_taxId_idx" ON "PedagogicalCompanySnapshot"("batchId", "taxId");
CREATE UNIQUE INDEX "PedagogicalStudentSnapshot_batchId_sourceId_key" ON "PedagogicalStudentSnapshot"("batchId", "sourceId");
CREATE INDEX "PedagogicalStudentSnapshot_batchId_companySourceId_idx" ON "PedagogicalStudentSnapshot"("batchId", "companySourceId");
CREATE INDEX "PedagogicalStudentSnapshot_batchId_name_idx" ON "PedagogicalStudentSnapshot"("batchId", "name");
CREATE INDEX "PedagogicalStudentSnapshot_batchId_cpf_idx" ON "PedagogicalStudentSnapshot"("batchId", "cpf");

-- AddForeignKey
ALTER TABLE "PedagogicalSnapshotBatch"
ADD CONSTRAINT "PedagogicalSnapshotBatch_syncRunId_fkey"
FOREIGN KEY ("syncRunId") REFERENCES "PedagogicalSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PedagogicalCompanySnapshot"
ADD CONSTRAINT "PedagogicalCompanySnapshot_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "PedagogicalSnapshotBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PedagogicalStudentSnapshot"
ADD CONSTRAINT "PedagogicalStudentSnapshot_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "PedagogicalSnapshotBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
