-- CreateEnum
CREATE TYPE "SyncIssueResolutionType" AS ENUM ('AUTO_SYNC', 'MANUAL');

-- AlterTable
ALTER TABLE "PedagogicalIssueState"
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "resolutionType" "SyncIssueResolutionType",
ADD COLUMN "resolvedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "PedagogicalIssueState_resolutionType_idx" ON "PedagogicalIssueState"("resolutionType");

-- AddForeignKey
ALTER TABLE "PedagogicalIssueState"
ADD CONSTRAINT "PedagogicalIssueState_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
