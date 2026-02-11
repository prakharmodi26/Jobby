-- Raise default minRecommendedScore to 50 and bump existing rows
ALTER TABLE "Settings" ALTER COLUMN "minRecommendedScore" SET DEFAULT 50;
UPDATE "Settings" SET "minRecommendedScore" = 50 WHERE "minRecommendedScore" IS NULL OR "minRecommendedScore" < 50;
