-- Recommended Redesign: Add RecommendedQuery + ScoringPattern, slim Profile + Settings

-- Create RecommendedQuery table
CREATE TABLE "RecommendedQuery" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "numPages" INTEGER NOT NULL DEFAULT 1,
    "country" TEXT NOT NULL DEFAULT 'us',
    "language" TEXT,
    "datePosted" TEXT NOT NULL DEFAULT 'all',
    "workFromHome" BOOLEAN NOT NULL DEFAULT false,
    "employmentTypes" TEXT,
    "jobRequirements" TEXT,
    "radius" INTEGER,
    "excludeJobPublishers" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendedQuery_pkey" PRIMARY KEY ("id")
);

-- Create ScoringPattern table
CREATE TABLE "ScoringPattern" (
    "id" SERIAL NOT NULL,
    "pattern" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 10,
    "effect" TEXT NOT NULL DEFAULT '+',
    "countOnce" BOOLEAN NOT NULL DEFAULT false,
    "disqualify" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringPattern_pkey" PRIMARY KEY ("id")
);

-- Slim down Profile: drop all columns except id, userMd, updatedAt
ALTER TABLE "Profile"
    DROP COLUMN IF EXISTS "targetTitles",
    DROP COLUMN IF EXISTS "skills",
    DROP COLUMN IF EXISTS "preferredLocations",
    DROP COLUMN IF EXISTS "remotePreferred",
    DROP COLUMN IF EXISTS "citizenshipNotRequired",
    DROP COLUMN IF EXISTS "seniority",
    DROP COLUMN IF EXISTS "yearsOfExperience",
    DROP COLUMN IF EXISTS "roleTypes",
    DROP COLUMN IF EXISTS "workModePreference",
    DROP COLUMN IF EXISTS "minSalary",
    DROP COLUMN IF EXISTS "maxSalary",
    DROP COLUMN IF EXISTS "education",
    DROP COLUMN IF EXISTS "degrees",
    DROP COLUMN IF EXISTS "industries",
    DROP COLUMN IF EXISTS "companySizePreference",
    DROP COLUMN IF EXISTS "companyTypes",
    DROP COLUMN IF EXISTS "avoidKeywords";

-- Slim down Settings: drop all weight columns and old recommended fields
ALTER TABLE "Settings"
    DROP COLUMN IF EXISTS "weightSkillMatch",
    DROP COLUMN IF EXISTS "weightTargetTitle",
    DROP COLUMN IF EXISTS "weightRecencyDay1",
    DROP COLUMN IF EXISTS "weightRecencyDay3",
    DROP COLUMN IF EXISTS "weightRecencyWeek",
    DROP COLUMN IF EXISTS "weightWorkModeMatch",
    DROP COLUMN IF EXISTS "weightSeniorityMatch",
    DROP COLUMN IF EXISTS "weightSeniorityMismatch",
    DROP COLUMN IF EXISTS "weightSalaryOverlap",
    DROP COLUMN IF EXISTS "weightSalaryBelow",
    DROP COLUMN IF EXISTS "weightIndustryMatch",
    DROP COLUMN IF EXISTS "weightEducationMeet",
    DROP COLUMN IF EXISTS "weightEducationUnder",
    DROP COLUMN IF EXISTS "weightCompanySize",
    DROP COLUMN IF EXISTS "weightExpMatch",
    DROP COLUMN IF EXISTS "weightExpMismatch",
    DROP COLUMN IF EXISTS "weightCitizenship",
    DROP COLUMN IF EXISTS "weightOptCptBoost",
    DROP COLUMN IF EXISTS "weightAvoidKeyword",
    DROP COLUMN IF EXISTS "recommendedDatePosted",
    DROP COLUMN IF EXISTS "excludePublishers",
    DROP COLUMN IF EXISTS "weightRemoteMatch",
    DROP COLUMN IF EXISTS "weightOnsiteMatch",
    DROP COLUMN IF EXISTS "weightExpMeet",
    DROP COLUMN IF EXISTS "weightExpClose",
    DROP COLUMN IF EXISTS "weightExpUnder";
