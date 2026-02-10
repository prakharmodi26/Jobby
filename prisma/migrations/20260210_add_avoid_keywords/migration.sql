-- Add avoidKeywords to Profile and weightAvoidKeyword to Settings
ALTER TABLE "Profile" ADD COLUMN "avoidKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Settings" ADD COLUMN "weightAvoidKeyword" INTEGER NOT NULL DEFAULT -15;
