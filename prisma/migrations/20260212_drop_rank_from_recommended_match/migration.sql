-- Drop rank column and related index from RecommendedMatch
DROP INDEX IF EXISTS "RecommendedMatch_runId_rank_idx";
ALTER TABLE "RecommendedMatch" DROP COLUMN IF EXISTS "rank";
CREATE INDEX "RecommendedMatch_runId_idx" ON "RecommendedMatch"("runId");
