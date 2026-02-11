-- Add minimum recommended score threshold
ALTER TABLE "Settings" ADD COLUMN "minRecommendedScore" INTEGER NOT NULL DEFAULT 0;
