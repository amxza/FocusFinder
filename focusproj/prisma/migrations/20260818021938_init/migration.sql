-- CreateEnum
CREATE TYPE "astroType" AS ENUM ('MILKYWAY', 'DEEPSKY', 'PLANETS', 'LUNAR');

-- CreateEnum
CREATE TYPE "Mount" AS ENUM ('NIKONF', 'CANONEF', 'SONYE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE');

-- CreateEnum
CREATE TYPE "Sources" AS ENUM ('REDDIT', 'ASTROBACKYARD', 'REVIEW_SITE');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchSession" (
    "id" TEXT NOT NULL,
    "preferredType" "astroType",
    "preferredMount" "Mount",
    "maxBudget" DOUBLE PRECISION NOT NULL,
    "experienceLevel" "ExperienceLevel",
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "aiExplain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "lensMount" TEXT NOT NULL,
    "focalLength" TEXT NOT NULL,
    "maxAperture" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "comaRating" INTEGER NOT NULL,
    "cornerSharpness" INTEGER NOT NULL,
    "manualFocusQuality" TEXT NOT NULL,
    "idealUseCase" TEXT[],
    "redditConsensusUrl" TEXT[],
    "averageReviewScore" DOUBLE PRECISION NOT NULL,
    "commonMistakes" TEXT[],
    "comparisonNotes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "lensId" TEXT NOT NULL,
    "source" "Sources",
    "sourceUrl" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "authorReputation" TEXT,
    "rating" INTEGER NOT NULL,
    "useCaseMatch" "astroType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LensComparison" (
    "id" TEXT NOT NULL,
    "primaryLensId" TEXT NOT NULL,
    "secondaryLensId" TEXT NOT NULL,
    "comparison" TEXT NOT NULL,

    CONSTRAINT "LensComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LensRecommendation" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "lensId" TEXT NOT NULL,

    CONSTRAINT "LensRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_username_key" ON "Customer"("username");

-- CreateIndex
CREATE UNIQUE INDEX "LensRecommendation_recommendationId_lensId_key" ON "LensRecommendation"("recommendationId", "lensId");

-- AddForeignKey
ALTER TABLE "SearchSession" ADD CONSTRAINT "SearchSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "SearchSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_lensId_fkey" FOREIGN KEY ("lensId") REFERENCES "Lens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensComparison" ADD CONSTRAINT "LensComparison_primaryLensId_fkey" FOREIGN KEY ("primaryLensId") REFERENCES "Lens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensComparison" ADD CONSTRAINT "LensComparison_secondaryLensId_fkey" FOREIGN KEY ("secondaryLensId") REFERENCES "Lens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensRecommendation" ADD CONSTRAINT "LensRecommendation_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensRecommendation" ADD CONSTRAINT "LensRecommendation_lensId_fkey" FOREIGN KEY ("lensId") REFERENCES "Lens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
