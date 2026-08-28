import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ASTRO_TYPE_LABELS } from "../lib/utils/constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type Mount = "NIKONF" | "CANONEF" | "SONYE";
type AstroType = "MILKYWAY" | "DEEPSKY" | "PLANETS" | "LUNAR";
type Source = "REDDIT" | "ASTROBACKYARD" | "REVIEW_SITE";

interface LensReview {
  source: string;
  sourceUrl: string;
  authorReputation?: string;
  quote: string;
  useCaseMatch: string;
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

// Phase 1 only supports these three mounts (matches the questionnaire form's
// "Nikon F / Canon EF/RF / Sony E" options -- see the sprint plan, Week 4).
// prisma/lenses.json also contains real mounts we don't model yet (Nikon Z,
// Fujifilm X, Sony A, Leica L, Micro Four Thirds, Pentax K, even a telescope
// M48 thread adapter) -- rather than silently mislabeling those as one of
// the three we do support, lenses with no supported mount are skipped.
const MOUNT_MAP: Record<string, Mount> = {
  "nikon f": "NIKONF",
  nikonf: "NIKONF",
  "canon ef": "CANONEF",
  canonef: "CANONEF",
  "canon rf": "CANONEF", // grouped with EF per the app's own "Canon EF/RF" dropdown option
  canonrf: "CANONEF",
  "sony e": "SONYE",
  sonye: "SONYE",
};

/** Returns the deduped list of *supported* mounts a lens is sold in. */
function mapMounts(mounts: string[]): Mount[] {
  const mapped = mounts
    .map((m) => MOUNT_MAP[m.trim().toLowerCase()])
    .filter((m): m is Mount => Boolean(m));
  return [...new Set(mapped)];
}

// Only astro-relevant tags map to an astroType. prisma/lenses.json mixes in
// non-astro genres (Landscape, Vlogging, Architecture, Travel, Portraiture,
// Wildlife, Sports) and the generic "Astrophotography" tag on general-purpose
// lenses -- those are dropped rather than defaulted to MILKYWAY. A lens whose
// *entire* idealUseCase list drops to empty isn't an astro lens and is
// skipped entirely (see main()).
const ASTRO_TYPE_MAP: Record<string, AstroType> = {
  "milky way": "MILKYWAY",
  "milky way mosaics": "MILKYWAY",
  "night sky": "MILKYWAY",
  "deep sky": "DEEPSKY",
  "deep-sky": "DEEPSKY",
  deepsky: "DEEPSKY",
  "nebulae & star clusters": "DEEPSKY",
  "large nebulae": "DEEPSKY",
  "tracked widefield dso": "DEEPSKY",
  "tracked deep-sky": "DEEPSKY",
  "tracked deep sky": "DEEPSKY",
  planetary: "PLANETS",
  planets: "PLANETS",
  lunar: "LUNAR",
  moon: "LUNAR",
};

/** Returns the deduped list of astro types a lens's tag list actually supports. */
function mapAstroTypes(useCases: string[]): AstroType[] {
  const mapped = useCases
    .map((u) => ASTRO_TYPE_MAP[u.trim().toLowerCase()])
    .filter((u): u is AstroType => Boolean(u));
  return [...new Set(mapped)];
}

function mapSource(source: string): Source {
  const sourceMap: Record<string, Source> = {
    reddit: "REDDIT",
    expert: "REVIEW_SITE",
    astrobackyard: "ASTROBACKYARD",
  };
  // Anything else (e.g. "Lonely Speck Astrophotography", "SLR Lounge",
  // "Dustin Abbott Photography") is a named review site -> REVIEW_SITE.
  return sourceMap[source.trim().toLowerCase()] || "REVIEW_SITE";
}

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

  console.log(`📖 Loaded ${lenses.length} lens entries from JSON`);

  // Step 2: Clear existing data (optional, only in development).
  // Recommendation -> LensRecommendation cascades on delete, but
  // Recommendation -> SearchSession and LensRecommendation -> Lens don't, so
  // SearchSessions/Recommendations from prior test runs (e.g. hitting
  // POST /api/questionnaire) must be cleared before Lens rows can be deleted.
  console.log("🗑️  Clearing existing data...");
  await prisma.recommendation.deleteMany({});
  await prisma.searchSession.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.lensComparison.deleteMany({});
  await prisma.lens.deleteMany({});

  let created = 0;
  let skippedNoMount = 0;
  let skippedNoAstroType = 0;

  for (const lensData of lenses) {
    const supportedMounts = mapMounts(lensData.mount);
    const supportedAstroTypes = mapAstroTypes(lensData.idealUseCase);

    if (supportedMounts.length === 0) {
      console.log(
        `⏭️  Skipping "${lensData.name}" -- no supported mount in ${JSON.stringify(lensData.mount)}`
      );
      skippedNoMount++;
      continue;
    }

    if (supportedAstroTypes.length === 0) {
      console.log(
        `⏭️  Skipping "${lensData.name}" -- no astro-relevant use case in ${JSON.stringify(lensData.idealUseCase)}`
      );
      skippedNoAstroType++;
      continue;
    }

    const avgScore = calculateAverageReviewScore(lensData.reviews);

    // The schema stores one mount per Lens row. A lens sold across multiple
    // supported mounts (e.g. the Sigma 14mm f/1.8 in EF/F/E versions) becomes
    // one row per mount so it's discoverable by shooters on any of them,
    // instead of only ever showing up under whichever mount happened to be
    // listed first in the JSON.
    for (const mount of supportedMounts) {
      console.log(`\n📸 Creating lens: ${lensData.name} (${mount})`);

      try {
        const lens = await prisma.lens.create({
          data: {
            name: lensData.name,
            brand: lensData.brand,
            lensMount: mount,
            focalLength: lensData.focalLength,
            maxAperture: lensData.maxAperture,
            price: lensData.price,
            comaRating: lensData.comaRating,
            cornerSharpness: lensData.cornerSharpness,
            manualFocusQuality: lensData.manualFocusQuality,
            // Stored as human-readable labels ("Milky Way", not "MILKYWAY")
            // to match what lib/utils/scoring.ts compares against -- see
            // ASTRO_TYPE_LABELS in lib/utils/constants.ts.
            idealUseCase: supportedAstroTypes.map((t) => ASTRO_TYPE_LABELS[t]),
            commonMistakes: lensData.commonMistakes,
            averageReviewScore: avgScore,
            redditConsensusUrl: [], // Will populate if you have Reddit URLs in reviews
            comparisonNotes: "", // Optional, leave empty for now
            imageUrl: null, // Optional, can add later
          },
        });

        created++;
        console.log(`   ✅ Lens created: ${lens.id}`);

        // Step 3: Create reviews for this lens
        if (lensData.reviews && lensData.reviews.length > 0) {
          for (const reviewData of lensData.reviews) {
            const [reviewAstroType] = mapAstroTypes([reviewData.useCaseMatch]);

            await prisma.review.create({
              data: {
                lensId: lens.id,
                source: mapSource(reviewData.source),
                sourceUrl: reviewData.sourceUrl,
                quote: reviewData.quote,
                authorReputation: reviewData.authorReputation || null,
                rating: reviewData.rating,
                useCaseMatch: reviewAstroType ?? null,
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
        console.error(`   ❌ Error creating lens ${lensData.name} (${mount}):`, error);
      }
    }
  }

  console.log("\n✨ Seed complete!");
  console.log(`✅ Created ${created} lens rows from ${lenses.length} catalog entries`);
  console.log(`⏭️  Skipped ${skippedNoMount} entries with no supported mount`);
  console.log(`⏭️  Skipped ${skippedNoAstroType} entries with no astro-relevant use case`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
