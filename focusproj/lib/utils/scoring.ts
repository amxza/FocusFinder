import type { astroType, ExperienceLevel } from "../../generated/prisma/enums";
import type { findCandidateLenses } from "../services/lensQuery";
import { lensMatchesAstroType, MAX_SCORE, SCORING_WEIGHTS } from "./constants";

// The base generated `Lens` model type doesn't include relations, but
// scoreCredibility needs `reviews` -- and every caller (via
// findCandidateLenses) always fetches lenses with reviews included. Deriving
// the type from that query keeps this in sync automatically.
type Lens = Awaited<ReturnType<typeof findCandidateLenses>>[number];

// Scoring logic lives here (Week 2, Wed-Thu per the sprint plan).
// Weighted model, revised so a lens's quality for the user's field outranks
// its price:
// Field quality x 0.50 + Experience x 0.20 + Budget x 0.15 + Credibility x 0.15
//
// Each scorer below returns points already on its final weighted scale
// (e.g. scoreFieldQuality returns 0-50, not 0-100), since scoreLens() clamps
// each result against MAX_SCORE directly.

export interface ScoringInput {
  lens: Lens;
  maxBudget: number;
  preferredType?: astroType | null;
  experienceLevel?: ExperienceLevel | null;
}

// The candidate query already drops lenses more than 10% over budget, so
// budget is a light preference here, not what drives the ranking. A lens
// using at least half the budget gets full credit. Cheaper lenses lose a
// little, since a big budget suggests the user wants better glass, and
// lenses over budget lose more.
const FULL_CREDIT_BUDGET_SHARE = 0.5;
const FREE_LENS_BUDGET_SCORE = 70; // pre-weight score at 0% of budget
const OVER_BUDGET_SCORE = 30; // pre-weight score above the budget

/** 0-15 points: how well the lens price fits the user's budget. */
export function scoreBudgetMatch({ lens, maxBudget }: ScoringInput): number {
  if (maxBudget <= 0) return 0;

  let rawScore: number; // 0-100 scale before weighting
  if (lens.price > maxBudget) {
    rawScore = OVER_BUDGET_SCORE;
  } else {
    const share = Math.min(1, lens.price / maxBudget / FULL_CREDIT_BUDGET_SHARE);
    rawScore = FREE_LENS_BUDGET_SCORE + share * (100 - FREE_LENS_BUDGET_SCORE);
  }

  return rawScore * SCORING_WEIGHTS.BUDGET;
}

// ---- Lens properties, each rated 0 (worst) to 1 (best) ----

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function focalLengthsMm(focalLength: string): number[] {
  return focalLength.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
}

/** Longest focal length in mm, e.g. "150-600mm" -> 600. */
export function longestFocalLengthMm(focalLength: string): number {
  const lengths = focalLengthsMm(focalLength);
  return lengths.length > 0 ? Math.max(...lengths) : 0;
}

// Log scale, because each doubling of focal length or aperture matters about
// equally.
function logRating(value: number, worst: number, best: number): number {
  return clamp01(Math.log(value / worst) / Math.log(best / worst));
}

/** Light gathering: f/5.6 or slower is 0, f/1.4 or faster is 1. */
function apertureRating(lens: Lens): number {
  return logRating(1 / lens.maxAperture, 1 / 5.6, 1 / 1.4);
}

function comaRating(lens: Lens): number {
  return clamp01((lens.comaRating - 1) / 4);
}

function sharpnessRating(lens: Lens): number {
  return clamp01((lens.cornerSharpness - 1) / 4);
}

/** Field of view for Milky Way shots: 35mm or longer is 0, 14mm or wider is 1. */
function wideRating(lens: Lens): number {
  const lengths = focalLengthsMm(lens.focalLength);
  if (lengths.length === 0) return 0;
  return clamp01((35 - Math.min(...lengths)) / (35 - 14));
}

/** Reach for planets and the Moon: 50mm or shorter is 0, 800mm or longer is 1. */
function reachRating(lens: Lens): number {
  return logRating(longestFocalLengthMm(lens.focalLength), 50, 800);
}

/** Reach for deep-sky targets, which need less: 50mm is 0, 300mm or longer is 1. */
function deepSkyReachRating(lens: Lens): number {
  return logRating(longestFocalLengthMm(lens.focalLength), 50, 300);
}

// What makes a lens good in each field, as weights that sum to 1.
const FIELD_QUALITY: Record<astroType, (lens: Lens) => number> = {
  MILKYWAY: (lens) =>
    0.35 * apertureRating(lens) +
    0.25 * comaRating(lens) +
    0.25 * wideRating(lens) +
    0.15 * sharpnessRating(lens),
  DEEPSKY: (lens) =>
    0.25 * apertureRating(lens) +
    0.25 * comaRating(lens) +
    0.25 * sharpnessRating(lens) +
    0.25 * deepSkyReachRating(lens),
  PLANETS: (lens) =>
    0.65 * reachRating(lens) + 0.25 * sharpnessRating(lens) + 0.1 * apertureRating(lens),
  LUNAR: (lens) =>
    0.55 * reachRating(lens) + 0.35 * sharpnessRating(lens) + 0.1 * apertureRating(lens),
};

/** Used when no field was requested: general astro optics. */
function generalQuality(lens: Lens): number {
  return 0.4 * apertureRating(lens) + 0.3 * comaRating(lens) + 0.3 * sharpnessRating(lens);
}

// Pre-weight bands. The best untagged lens (45) still scores below the
// worst tagged one (50), so a lens tagged for the field always ranks first.
const TAGGED_FLOOR = 50;
const UNTAGGED_CEILING = 45;

/** 0-50 points: how well the lens's qualities serve the requested field. */
export function scoreFieldQuality({ lens, preferredType }: ScoringInput): number {
  let rawScore: number; // 0-100 scale before weighting
  if (!preferredType) {
    rawScore = TAGGED_FLOOR + (100 - TAGGED_FLOOR) * generalQuality(lens);
  } else {
    const quality = FIELD_QUALITY[preferredType](lens);
    rawScore =
      lensMatchesAstroType(lens.idealUseCase, preferredType) === true
        ? TAGGED_FLOOR + (100 - TAGGED_FLOOR) * quality
        : UNTAGGED_CEILING * quality;
  }

  return rawScore * SCORING_WEIGHTS.FIELD_QUALITY;
}

// Heuristics for reading beginner-friendliness out of the current Lens
// fields (there's no dedicated "difficulty tier" field yet):
//  - "focus-by-wire" rings with no physical infinity hard stop are the
//    classic beginner trap (easy to rack past infinity with nothing to
//    stop on) -> counts as "requires precise manual focus".
//  - Very fast apertures (<=f/2) have a razor-thin focus tolerance, making
//    the focus ring unforgiving even when it's mechanically nice -> counts
//    as "difficult focus ring".
//  - Any documented commonMistakes for the lens counts as "a common
//    beginner mistake applies", since those are literally beginner pitfalls
//    logged per-lens.
// Revisit once manualFocusQuality has structured tiers instead of prose.
const FOCUS_BY_WIRE_PATTERN = /focus-by-wire/i;
const HARD_STOP_PATTERN = /hard stop|distance scale/i;
const FAST_APERTURE_THRESHOLD = 2.0;

function requiresPreciseManualFocus(lens: Lens): boolean {
  return (
    FOCUS_BY_WIRE_PATTERN.test(lens.manualFocusQuality) &&
    !HARD_STOP_PATTERN.test(lens.manualFocusQuality)
  );
}

function hasDifficultFocusRing(lens: Lens): boolean {
  return lens.maxAperture <= FAST_APERTURE_THRESHOLD;
}

function hasCommonBeginnerMistake(lens: Lens): boolean {
  return lens.commonMistakes.length > 0;
}

/** 0-20 points: how appropriate the lens is for the user's experience level. */
export function scoreExperience({ lens, experienceLevel }: ScoringInput): number {
  let rawScore = 100; // 0-100 scale before weighting

  if (experienceLevel === "BEGINNER") {
    if (requiresPreciseManualFocus(lens)) rawScore -= 20;
    if (hasDifficultFocusRing(lens)) rawScore -= 15;
    if (hasCommonBeginnerMistake(lens)) rawScore -= 25;
    rawScore = Math.max(0, rawScore);
  }
  // INTERMEDIATE (or unspecified): no penalties.

  return rawScore * SCORING_WEIGHTS.EXPERIENCE;
}

/** 0-15 points: community credibility (Reddit consensus, review scores). */
export function scoreCredibility({ lens }: ScoringInput): number {
  const reviews = lens.reviews ?? [];

  const avgReviewRating = lens.averageReviewScore || 0; // 0-5 scale
  const numberOfReviews = reviews.length;
  // "Expert" sources = distinct outlets backing the lens, not raw review
  // count -- one Reddit thread and one AstroBackyard writeup both count once
  // each. TODO: expand as more sources come online (currently just the one).
  const expertSources = new Set(reviews.map((r) => r.source).filter(Boolean)).size;

  const rawScore = avgReviewRating * 20 + numberOfReviews * 10 + expertSources * 5;
  const clampedRaw = Math.min(100, rawScore); // cap at 100 before weighting

  return clampedRaw * SCORING_WEIGHTS.CREDIBILITY;
}

export interface ScoreBreakdown {
  fieldQuality: number;
  experience: number;
  budget: number;
  credibility: number;
  total: number;
}

export function scoreLens(input: ScoringInput): ScoreBreakdown {
  const fieldQuality = clamp(scoreFieldQuality(input), 0, MAX_SCORE.FIELD_QUALITY);
  const experience = clamp(scoreExperience(input), 0, MAX_SCORE.EXPERIENCE);
  const budget = clamp(scoreBudgetMatch(input), 0, MAX_SCORE.BUDGET);
  const credibility = clamp(scoreCredibility(input), 0, MAX_SCORE.CREDIBILITY);

  return {
    fieldQuality,
    experience,
    budget,
    credibility,
    total: fieldQuality + experience + budget + credibility,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
