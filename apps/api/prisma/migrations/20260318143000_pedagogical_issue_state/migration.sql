-- CreateTable
CREATE TABLE "PedagogicalIssueState" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entitySourceId" TEXT,
    "code" TEXT NOT NULL,
    "severity" "SyncIssueSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "openedByRunId" TEXT NOT NULL,
    "lastSeenByRunId" TEXT NOT NULL,
    "resolvedByRunId" TEXT,

    CONSTRAINT "PedagogicalIssueState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedagogicalIssueState_fingerprint_key" ON "PedagogicalIssueState"("fingerprint");

-- CreateIndex
CREATE INDEX "PedagogicalIssueState_resolvedAt_lastSeenAt_idx" ON "PedagogicalIssueState"("resolvedAt", "lastSeenAt");

-- CreateIndex
CREATE INDEX "PedagogicalIssueState_entityType_code_idx" ON "PedagogicalIssueState"("entityType", "code");

-- AddForeignKey
ALTER TABLE "PedagogicalIssueState" ADD CONSTRAINT "PedagogicalIssueState_openedByRunId_fkey" FOREIGN KEY ("openedByRunId") REFERENCES "PedagogicalSyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIssueState" ADD CONSTRAINT "PedagogicalIssueState_lastSeenByRunId_fkey" FOREIGN KEY ("lastSeenByRunId") REFERENCES "PedagogicalSyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedagogicalIssueState" ADD CONSTRAINT "PedagogicalIssueState_resolvedByRunId_fkey" FOREIGN KEY ("resolvedByRunId") REFERENCES "PedagogicalSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
