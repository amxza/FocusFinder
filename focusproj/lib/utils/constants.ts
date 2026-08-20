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

// Budget bucket boundaries used by the questionnaire form (Week 4).
export const BUDGET_TIERS = {
  UNDER_300: { min: 0, max: 300 },
  "300_600": { min: 300, max: 600 },
  "600_1000": { min: 600, max: 1000 },
  OVER_1000: { min: 1000, max: Number.POSITIVE_INFINITY },
} as const;
