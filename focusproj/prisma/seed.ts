import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface LensReview {
  source: "REDDIT" | "EXPERT" | "ASTROBACKYARD";
  sourceUrl: string;
  authorReputation?: string;
  quote: string;
  useCaseMatch: "MILKYWAY" | "DEEPSKY" | "PLANETS" | "LUNAR";
  rating: number;
}

interface LensData {
  name: string;
  brand: string;
  mount: string[];
  focalLength: string;
  maxAperture: number;
  price: number;
  comaRating: number;
  cornerSharpness: number;
  manualFocusQuality: string;
  idealUseCase: string[];
  commonMistakes: string[];
  reviews: LensReview[];
}

// Helper function to map your JSON mount names to schema enum values
function mapMount(mount: string): "NIKONF" | "CANONEF" | "SONYE" {
  const mountMap: { [key: string]: "NIKONF" | "CANONEF" | "SONYE" } = {
    "Nikon F": "NIKONF",
    "NikonF": "NIKONF",
    "Canon EF": "CANONEF",
    "CanonEF": "CANONEF",
    "Sony E": "SONYE",
    "SonyE": "SONYE",
  };
  return mountMap[mount] || "NIKONF"; // Default to Nikon if unknown
}

// Helper function to map your JSON astro type to schema enum
function mapAstroType(
  astroType: string
): "MILKYWAY" | "DEEPSKY" | "PLANETS" | "LUNAR" {
  const astroMap: {
    [key: string]: "MILKYWAY" | "DEEPSKY" | "PLANETS" | "LUNAR";
  } = {
    "Milky Way": "MILKYWAY",
    "MILKYWAY": "MILKYWAY",
    "Deep Sky": "DEEPSKY",
    "DEEPSKY": "DEEPSKY",
    "Planetary": "PLANETS",
    "PLANETS": "PLANETS",
    "Lunar": "LUNAR",
    "LUNAR": "LUNAR",
    "Night Sky": "MILKYWAY", // Default night sky to Milky Way
  };
  return astroMap[astroType] || "MILKYWAY";
}

// Helper function to map review source
function mapSource(source: string): "REDDIT" | "ASTROBACKYARD" | "REVIEW_SITE" {
  const sourceMap: {
    [key: string]: "REDDIT" | "ASTROBACKYARD" | "REVIEW_SITE";
  } = {
    "REDDIT": "REDDIT",
    "Reddit": "REDDIT",
    "EXPERT": "REVIEW_SITE",
    "Expert": "REVIEW_SITE",
    "ASTROBACKYARD": "ASTROBACKYARD",
    "AstroBackyard": "ASTROBACKYARD",
  };
  return sourceMap[source] || "REVIEW_SITE";
}

// Calculate average review score
function calculateAverageReviewScore(reviews: LensReview[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10; // Round to 1 decimal
}

async function main() {
  console.log("🚀 Starting seed...");

  // Step 1: Read JSON file
  const filePath = path.join(__dirname, "lenses.json");
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lenses: LensData[] = JSON.parse(fileContent);

  console.log(`📖 Loaded ${lenses.length} lenses from JSON`);

  // Step 2: Clear existing data (optional, only in development)
  console.log("🗑️  Clearing existing data...");
  await prisma.review.deleteMany({});
  await prisma.lensComparison.deleteMany({});
  await prisma.lens.deleteMany({});

  // Step 3: Create each lens + its reviews
  for (const lensData of lenses) {
    console.log(`\n📸 Creating lens: ${lensData.name}`);

    try {
      // Map astro types to enum values
      const mappedUseCase = lensData.idealUseCase.map(mapAstroType);

      // Calculate average review score
      const avgScore = calculateAverageReviewScore(lensData.reviews);

      // Create the lens
      const lens = await prisma.lens.create({
        data: {
          name: lensData.name,
          brand: lensData.brand,
          lensMount: mapMount(lensData.mount[0] || "Nikon F"), // Use primary mount
          focalLength: lensData.focalLength,
          maxAperture: lensData.maxAperture,
          price: lensData.price,
          comaRating: lensData.comaRating,
          cornerSharpness: lensData.cornerSharpness,
          manualFocusQuality: lensData.manualFocusQuality,
          idealUseCase: mappedUseCase, // Convert to enum values
          commonMistakes: lensData.commonMistakes,
          averageReviewScore: avgScore, // Calculated from reviews
          redditConsensusUrl: [], // Will populate if you have Reddit URLs in reviews
          comparisonNotes: "", // Optional, leave empty for now
          imageUrl: null, // Optional, can add later
        },
      });

      console.log(`   ✅ Lens created: ${lens.id}`);

      // Step 4: Create reviews for this lens
      if (lensData.reviews && lensData.reviews.length > 0) {
        for (const reviewData of lensData.reviews) {
          const review = await prisma.review.create({
            data: {
              lensId: lens.id,
              source: mapSource(reviewData.source),
              sourceUrl: reviewData.sourceUrl,
              quote: reviewData.quote,
              authorReputation: reviewData.authorReputation || null,
              rating: reviewData.rating,
              useCaseMatch: mapAstroType(reviewData.useCaseMatch),
            },
          });

          console.log(
            `   📝 Review added: ${reviewData.source} (${reviewData.rating}/5)`
          );
        }
      } else {
        console.log(`   ⚠️  No reviews found for this lens`);
      }
    } catch (error) {
      console.error(`   ❌ Error creating lens ${lensData.name}:`, error);
    }
  }

  console.log("\n✨ Seed complete!");
  console.log(`✅ Created ${lenses.length} lenses with reviews`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });