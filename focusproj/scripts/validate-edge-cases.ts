import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../lib/prisma";
import { rankLenses, type RankedLens } from "../lib/services/recommendationEngine";
import type { astroType, ExperienceLevel, Mount } from "../generated/prisma/enums";

// Week 3, Wed-Thu (per the sprint plan): the specific named edge cases +
// a 10-persona test dataset. Unlike scripts/validate-combinations.ts (pure
// numeric sweep), this one is narrative -- it prints what the engine
// actually recommends for each scenario so a human can sanity-check it.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Scenario {
  name: string;
  note: string;
  input: {
    mount?: Mount;
    astroType?: astroType;
    budget: number;
    experienceLevel?: ExperienceLevel;
  };
}

function fmt(ranked: RankedLens[]) {
  return ranked.map((r, i) => ({
    rank: i + 1,
    name: r.lens.name,
    mount: r.lens.lensMount,
    price: r.lens.price,
    idealUseCase: r.lens.idealUseCase,
    comaRating: r.lens.comaRating,
    focalLength: r.lens.focalLength,
    score: Math.round(r.score * 10) / 10,
    breakdown: {
      budget: Math.round(r.breakdown.budget * 10) / 10,
      astroFit: Math.round(r.breakdown.astroFit * 10) / 10,
      experience: Math.round(r.breakdown.experience * 10) / 10,
      credibility: Math.round(r.breakdown.credibility * 10) / 10,
    },
  }));
}

async function run(scenarios: Scenario[]) {
  const out: { name: string; note: string; input: Scenario["input"]; results: ReturnType<typeof fmt> }[] = [];

  for (const s of scenarios) {
    const ranked = await rankLenses(s.input);
    out.push({ name: s.name, note: s.note, input: s.input, results: fmt(ranked) });

    console.log(`\n=== ${s.name} ===`);
    console.log(`   ${s.note}`);
    console.log(`   input: ${JSON.stringify(s.input)}`);
    if (ranked.length === 0) {
      console.log("   -> NO RESULTS");
      continue;
    }
    for (const r of fmt(ranked)) {
      console.log(
        `   #${r.rank} ${r.name} (${r.mount}, $${r.price}, coma ${r.comaRating}, ${r.focalLength}) ` +
          `-> score ${r.score} [budget ${r.breakdown.budget} / astroFit ${r.breakdown.astroFit} / ` +
          `exp ${r.breakdown.experience} / cred ${r.breakdown.credibility}] tags=${r.idealUseCase.join(", ")}`
      );
    }
  }

  return out;
}

const EDGE_CASES: Scenario[] = [
  {
    name: "Edge case 1: Beginner + $300 budget",
    note:
      "Plan expects the best-value pick to surface (e.g. a Rokinon prime). No mount filter, so this is across all 3 mounts.",
    input: { budget: 300, experienceLevel: "BEGINNER" },
  },
  {
    name: 'Edge case 2: "Experienced" + $1000+ budget',
    note:
      'Schema has no EXPERIENCED tier (only BEGINNER/INTERMEDIATE) -- mapped to INTERMEDIATE, the closer of the two. Plan expects premium options to surface.',
    input: { budget: 1500, experienceLevel: "INTERMEDIATE" },
  },
  {
    name: "Edge case 3: Deep Sky focus",
    note:
      "Plan expects wide/low-coma lenses to be prioritized. Catalog only has 1 distinct Deep-Sky-tagged lens (seeded per-mount), so this mostly checks it correctly outranks non-Deep-Sky lenses rather than testing a real ranking among several.",
    input: { astroType: "DEEPSKY", budget: 1000 },
  },
  {
    name: "Edge case 4: Planetary focus",
    note:
      "Plan expects longer focal length to be prioritized. IMPORTANT: the current 28-lens catalog has ZERO lenses tagged Planetary -- this checks the engine degrades gracefully (still returns budget/mount-filtered results) rather than validating planetary-specific ranking, which isn't possible with this data yet.",
    input: { astroType: "PLANETS", budget: 1000 },
  },
];

// 10 realistic user personas (Week 3, Wed-Thu deliverable).
const PERSONAS: Scenario[] = [
  {
    name: "Persona 1: Complete beginner, tight budget",
    note: "First-time astro shooter, doesn't want to overspend.",
    input: { mount: "NIKONF", astroType: "MILKYWAY", budget: 300, experienceLevel: "BEGINNER" },
  },
  {
    name: "Persona 2: Weekend Milky Way shooter",
    note: "Some experience, mid budget, wants a solid all-rounder.",
    input: { mount: "SONYE", astroType: "MILKYWAY", budget: 800, experienceLevel: "INTERMEDIATE" },
  },
  {
    name: "Persona 3: Deep sky enthusiast upgrading gear",
    note: "Ready to spend for coma control and sharpness.",
    input: { mount: "CANONEF", astroType: "DEEPSKY", budget: 1500, experienceLevel: "INTERMEDIATE" },
  },
  {
    name: "Persona 4: New to astro, doesn't know their camera type",
    note: "Left mount and astro type unspecified -- tests the fully-open-ended path.",
    input: { budget: 300, experienceLevel: "BEGINNER" },
  },
  {
    name: "Persona 5: Lunar photographer on a budget",
    note: "Wants moon shots without breaking the bank.",
    input: { mount: "SONYE", astroType: "LUNAR", budget: 500, experienceLevel: "BEGINNER" },
  },
  {
    name: "Persona 6: Planetary imager, high budget",
    note: "Willing to spend big on reach -- exercises the zero-Planetary-lens data gap under real budget pressure.",
    input: { mount: "CANONEF", astroType: "PLANETS", budget: 1500, experienceLevel: "INTERMEDIATE" },
  },
  {
    name: "Persona 7: Unsure what they want",
    note: "Only gave a budget -- everything else defaults to unspecified.",
    input: { budget: 800 },
  },
  {
    name: "Persona 8: Experienced shooter, very tight budget",
    note: "Tests the smallest-inventory corner (Nikon F, under $300).",
    input: { mount: "NIKONF", budget: 280, experienceLevel: "INTERMEDIATE" },
  },
  {
    name: "Persona 9: Deep sky beginner, mid budget",
    note: "Wants nebulae/galaxies but is new to manual focus.",
    input: { mount: "SONYE", astroType: "DEEPSKY", budget: 800, experienceLevel: "BEGINNER" },
  },
  {
    name: "Persona 10: Premium all-rounder buyer",
    note: "High budget, broad astro interest, wants the best glass available.",
    input: { mount: "SONYE", astroType: "MILKYWAY", budget: 2200, experienceLevel: "INTERMEDIATE" },
  },
];

async function main() {
  console.log("############ EDGE CASES ############");
  const edgeCaseResults = await run(EDGE_CASES);

  console.log("\n\n############ PERSONAS ############");
  const personaResults = await run(PERSONAS);

  const reportPath = path.join(__dirname, "..", "reports", "edge-cases-and-personas.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ edgeCases: edgeCaseResults, personas: personaResults }, null, 2)
  );
  console.log(`\n\nFull results written to ${reportPath}`);
}

main()
  .catch((e) => {
    console.error("Validation script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
