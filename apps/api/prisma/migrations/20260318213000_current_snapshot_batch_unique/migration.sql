WITH ranked_current_batches AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      ORDER BY COALESCE("publishedAt", "createdAt") DESC, "createdAt" DESC, "id" DESC
    ) AS "row_number"
  FROM "PedagogicalSnapshotBatch"
  WHERE "status" = 'CURRENT'
)
UPDATE "PedagogicalSnapshotBatch"
SET
  "status" = 'SUPERSEDED',
  "finishedAt" = COALESCE("finishedAt", NOW())
WHERE "id" IN (
  SELECT "id"
  FROM ranked_current_batches
  WHERE "row_number" > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "PedagogicalSnapshotBatch_single_current_idx"
ON "PedagogicalSnapshotBatch" ("status")
WHERE "status" = 'CURRENT';
