import { astroType } from "../../generated/prisma/enums";

// Shared constants for the recommendation engine.
// Scoring weights come from Week 1's algorithm spec:
// Budget x 0.35 + AstroFit x 0.30 + Experience x 0.20 + Credibility x 0.15

export const SCORING_WEIGHTS = {
  BUDGET: 0.35,
  ASTRO_FIT: 0.3,
  EXPERIENCE: 0.2,
  CREDIBILITY: 0.15,
} as const;

// Max raw points per scorer before weighting (per the spec doc).
export const MAX_SCORE = {
  BUDGET: 35,
  ASTRO_FIT: 30,
  EXPERIENCE: 20,
  CREDIBILITY: 15,
} as const;

export const TOP_N_RECOMMENDATIONS = 5;

// Lens.idealUseCase is stored as free-text labels (e.g. "Milky Way"), while
// user preference comes in as the astroType enum. This maps enum -> label so
// scoring can compare the two. Adjust if lens data ends up using different
// wording (worth double-checking against prisma/lenses.json).
export const ASTRO_TYPE_LABELS: Record<astroType, string> = {
  [astroType.MILKYWAY]: "Milky Way",
  [astroType.DEEPSKY]: "Deep Sky",
  [astroType.PLANETS]: "Planetary",
  [astroType.LUNAR]: "Lunar",
};

// Budget bucket boundaries used by the questionnaire form (Week 4).
export const BUDGET_TIERS = {
  UNDER_300: { min: 0, max: 300 },
  "300_600": { min: 300, max: 600 },
  "600_1000": { min: 600, max: 1000 },
  OVER_1000: { min: 1000, max: Number.POSITIVE_INFINITY },
} as const;

// Buckets a raw budget number into the same tiers the questionnaire form
// uses (Week 3, Claude explanation generator). Used both in the prompt text
// and as part of the explanation cache key -- bucketing (instead of the raw
// dollar amount) is what makes the cache actually hit across users with
// similar-but-not-identical budgets.
export function getBudgetTierLabel(budget: number): string {
  if (budget <= BUDGET_TIERS.UNDER_300.max) return "under $300";
  if (budget <= BUDGET_TIERS["300_600"].max) return "$300-600";
  if (budget <= BUDGET_TIERS["600_1000"].max) return "$600-1000";
  return "$1000+";
}
