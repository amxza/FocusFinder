import type { Lens } from "../../generated/prisma/models";
import type { astroType, ExperienceLevel } from "../../generated/prisma/enums";
import { MAX_SCORE } from "./constants";

// Scoring logic lives here (Week 2, Wed-Thu per the sprint plan).
// These are placeholder stubs so the routes/services layer has something
// to call against — fill in the real math from the algorithm spec.

export interface ScoringInput {
  lens: Lens;
  maxBudget: number;
  preferredType?: astroType | null;
  experienceLevel?: ExperienceLevel | null;
}

/** 0-35 points: how well the lens price fits the user's budget. */
export function scoreBudgetMatch(_input: ScoringInput): number {
  // TODO: implement per algorithm spec (over-budget penalty, etc.)
  return 0;
}

/** 0-30 points: how well the lens suits the requested astro type. */
export function scoreAstroFit(_input: ScoringInput): number {
  // TODO: implement per algorithm spec (idealUseCase match, coma/sharpness weighting)
  return 0;
}

/** 0-20 points: how appropriate the lens is for the user's experience level. */
export function scoreExperience(_input: ScoringInput): number {
  // TODO: implement per algorithm spec (beginner + expensive lens handling, etc.)
  return 0;
}

/** 0-15 points: community credibility (Reddit consensus, review scores). */
export function scoreCredibility(_input: ScoringInput): number {
  // TODO: implement per algorithm spec (unknown-lens default score, etc.)
  return 0;
}

export interface ScoreBreakdown {
  budget: number;
  astroFit: number;
  experience: number;
  credibility: number;
  total: number;
}

export function scoreLens(input: ScoringInput): ScoreBreakdown {
  const budget = clamp(scoreBudgetMatch(input), 0, MAX_SCORE.BUDGET);
  const astroFit = clamp(scoreAstroFit(input), 0, MAX_SCORE.ASTRO_FIT);
  const experience = clamp(scoreExperience(input), 0, MAX_SCORE.EXPERIENCE);
  const credibility = clamp(scoreCredibility(input), 0, MAX_SCORE.CREDIBILITY);

  return {
    budget,
    astroFit,
    experience,
    credibility,
    total: budget + astroFit + experience + credibility,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
