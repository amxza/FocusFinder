import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../lib/prisma";
import { rankLenses } from "../lib/services/recommendationEngine";
import { ASTRO_TYPE_LABELS, MAX_SCORE } from "../lib/utils/constants";
import type { astroType, ExperienceLevel, Mount } from "../generated/prisma/enums";

// Week 3, Wed-Thu (per the sprint plan): sweep every questionnaire
// combination and check (a) each combo returns a sane result count, (b) the
// top pick actually matches the requested astro type when a match exists in
// the catalog, (c) mount/budget filters hold, (d) scores stay in-bounds.
//
// The plan's 4x5x4x3=240 count assumed 4 mount options / 5 astro options
// (the extra one in each being the form's "Other"/"Unsure" -> unspecified).
// With Nikon Z and Canon RF added there are 5 real mounts, so "unspecified"
// (undefined) makes this 6x5x4x3=360.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MOUNTS: (Mount | undefined)[] = [undefined, "NIKONF", "NIKONZ", "CANONEF", "CANONRF", "SONYE"];
const ASTRO_TYPES: (astroType | undefined)[] = [
  undefined,
  "MILKYWAY",
  "DEEPSKY",
  "PLANETS",
  "LUNAR",
];
const EXPERIENCE_LEVELS: (ExperienceLevel | undefined)[] = [
  undefined,
  "BEGINNER",
  "INTERMEDIATE",
];

// Representative dollar amount per questionnaire budget tier (Week 4 form).
const BUDGET_SAMPLES: { label: string; value: number }[] = [
  { label: "under $300", value: 280 },
  { label: "$300-600", value: 500 },
  { label: "$600-1000", value: 850 },
  { label: "$1000+", value: 1500 },
];

interface ComboResult {
  mount: Mount | "unspecified";
  astroType: astroType | "unspecified";
  budgetLabel: string;
  budget: number;
  experienceLevel: ExperienceLevel | "unspecified";
  resultCount: number;
  scores: number[];
  topLensName: string | null;
  topLensMatchesAstroType: boolean | null; // null when astroType unspecified
  matchingLensWasAvailableButNotTop: boolean;
  allWithinMount: boolean;
  allWithinBudgetAllowance: boolean;
  scoreBoundsOk: boolean;
}

async function main() {
  const results: ComboResult[] = [];
  let combosRun = 0;

  for (const mount of MOUNTS) {
    for (const astro of ASTRO_TYPES) {
      for (const budgetSample of BUDGET_SAMPLES) {
        for (const experienceLevel of EXPERIENCE_LEVELS) {
          const ranked = await rankLenses({
            mount,
            astroType: astro,
            budget: budgetSample.value,
            experienceLevel,
          });
          combosRun++;

          const preferredLabel = astro ? ASTRO_TYPE_LABELS[astro] : undefined;
          const topLensMatchesAstroType = astro
            ? (ranked[0]?.lens.idealUseCase.includes(preferredLabel!) ?? null)
            : null;

          // Was there a matching-tag lens in the full candidate pool (same
          // mount/budget) that just didn't end up ranked #1? Distinguishes
          // "no matching lens exists" (fine) from "one existed but scoring
          // buried it" (worth a look).
          let matchingLensWasAvailableButNotTop = false;
          if (astro && topLensMatchesAstroType === false) {
            matchingLensWasAvailableButNotTop = ranked.some((r) =>
              r.lens.idealUseCase.includes(preferredLabel!)
            );
          }

          const scoreBoundsOk = ranked.every(
            (r) =>
              r.breakdown.fieldQuality >= 0 &&
              r.breakdown.fieldQuality <= MAX_SCORE.FIELD_QUALITY &&
              r.breakdown.experience >= 0 &&
              r.breakdown.experience <= MAX_SCORE.EXPERIENCE &&
              r.breakdown.budget >= 0 &&
              r.breakdown.budget <= MAX_SCORE.BUDGET &&
              r.breakdown.credibility >= 0 &&
              r.breakdown.credibility <= MAX_SCORE.CREDIBILITY &&
              r.score >= 0 &&
              r.score <= 100
          );

          results.push({
            mount: mount ?? "unspecified",
            astroType: astro ?? "unspecified",
            budgetLabel: budgetSample.label,
            budget: budgetSample.value,
            experienceLevel: experienceLevel ?? "unspecified",
            resultCount: ranked.length,
            scores: ranked.map((r) => Math.round(r.score * 10) / 10),
            topLensName: ranked[0]?.lens.name ?? null,
            topLensMatchesAstroType,
            matchingLensWasAvailableButNotTop,
            allWithinMount: mount
              ? ranked.every((r) => r.lens.lensMount === mount)
              : true,
            allWithinBudgetAllowance: ranked.every(
              (r) => r.lens.price <= budgetSample.value * 1.1
            ),
            scoreBoundsOk,
          });
        }
      }
    }
  }

  // ---- Aggregate ----
  const zeroResultCombos = results.filter((r) => r.resultCount === 0);
  const oneOrTwoResultCombos = results.filter(
    (r) => r.resultCount === 1 || r.resultCount === 2
  );
  const threeToFiveResultCombos = results.filter(
    (r) => r.resultCount >= 3 && r.resultCount <= 5
  );
  const overFiveResultCombos = results.filter((r) => r.resultCount > 5);
  const mountViolations = results.filter((r) => !r.allWithinMount);
  const budgetViolations = results.filter((r) => !r.allWithinBudgetAllowance);
  const scoreBoundViolations = results.filter((r) => !r.scoreBoundsOk);
  const astroMismatches = results.filter((r) => r.matchingLensWasAvailableButNotTop);

  const summary = {
    totalCombosRun: combosRun,
    expectedCombos: MOUNTS.length * ASTRO_TYPES.length * BUDGET_SAMPLES.length * EXPERIENCE_LEVELS.length,
    resultCountDistribution: {
      zero: zeroResultCombos.length,
      oneOrTwo: oneOrTwoResultCombos.length,
      threeToFive: threeToFiveResultCombos.length,
      overFive: overFiveResultCombos.length,
    },
    mountFilterViolations: mountViolations.length,
    budgetFilterViolations: budgetViolations.length,
    scoreBoundViolations: scoreBoundViolations.length,
    astroMismatchesWithAvailableMatch: astroMismatches.length,
  };

  console.log("=== Combination Sweep Summary ===");
  console.log(JSON.stringify(summary, null, 2));

  if (zeroResultCombos.length > 0) {
    console.log(`\n--- 0-result combos (${zeroResultCombos.length}) ---`);
    for (const r of zeroResultCombos.slice(0, 20)) {
      console.log(
        `  mount=${r.mount} astro=${r.astroType} budget=${r.budgetLabel} exp=${r.experienceLevel}`
      );
    }
    if (zeroResultCombos.length > 20) console.log(`  ...and ${zeroResultCombos.length - 20} more`);
  }

  if (astroMismatches.length > 0) {
    console.log(`\n--- Astro-type mismatches where a match WAS available (${astroMismatches.length}) ---`);
    for (const r of astroMismatches.slice(0, 20)) {
      console.log(
        `  mount=${r.mount} astro=${r.astroType} budget=${r.budgetLabel} exp=${r.experienceLevel} -> top pick: ${r.topLensName}`
      );
    }
  }

  if (mountViolations.length > 0) {
    console.error(`\n!!! Mount filter violated in ${mountViolations.length} combos`);
  }
  if (budgetViolations.length > 0) {
    console.error(`\n!!! Budget allowance violated in ${budgetViolations.length} combos`);
  }
  if (scoreBoundViolations.length > 0) {
    console.error(`\n!!! Score bounds violated in ${scoreBoundViolations.length} combos`);
  }

  const reportPath = path.join(__dirname, "..", "reports", "combination-sweep.json");
  fs.writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nFull results written to ${reportPath}`);
}

main()
  .catch((e) => {
    console.error("Validation script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
