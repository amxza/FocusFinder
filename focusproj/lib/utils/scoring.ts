import type { astroType, ExperienceLevel } from "../../generated/prisma/enums";
import type { findCandidateLenses } from "../services/lensQuery";
import { ASTRO_TYPE_LABELS, MAX_SCORE, SCORING_WEIGHTS } from "./constants";

// The base generated `Lens` model type doesn't include relations, but
// scoreCredibility needs `reviews` -- and every caller (via
// findCandidateLenses) always fetches lenses with reviews included. Deriving
// the type from that query keeps this in sync automatically.
type Lens = Awaited<ReturnType<typeof findCandidateLenses>>[number];

// Scoring logic lives here (Week 2, Wed-Thu per the sprint plan).
// Implements the weighted model from the algorithm spec:
// Budget x 0.35 + AstroFit x 0.30 + Experience x 0.20 + Credibility x 0.15
//
// Each scorer below returns points already on its final weighted scale
// (e.g. scoreBudgetMatch returns 0-35, not 0-100), since scoreLens() clamps
// each result against MAX_SCORE directly.

export interface ScoringInput {
  lens: Lens;
  maxBudget: number;
  preferredType?: astroType | null;
  experienceLevel?: ExperienceLevel | null;
}

// Pre-weight range for an in-budget lens: 70 (priced right at the ceiling)
// to 100 (free). See the comment in scoreBudgetMatch for why this is a
// narrow band rather than the full 0-100 range.
const IN_BUDGET_SCORE_FLOOR = 70;
const IN_BUDGET_SCORE_CEILING = 100;

/** 0-35 points: how well the lens price fits the user's budget. */
export function scoreBudgetMatch({ lens, maxBudget }: ScoringInput): number {
  if (maxBudget <= 0) return 0;

  let rawScore: number; // 0-100 scale before weighting
  if (lens.price <= maxBudget) {
    // Mildly reward staying under budget -- this used to be a straight
    // (1 - price/maxBudget) line spanning the full 0-100 range, which let
    // "leftover budget" alone swing the full 35-point BUDGET weight
    // between two otherwise-identical lenses. Since BUDGET is the largest
    // of the four weights, that dominated astroFit/experience/credibility
    // combined, and a query like "experienced, $1500 budget" always
    // surfaced the cheapest catalog lens instead of a premium one (see the
    // Week 3 Wed-Thu validation report). Compressing the in-budget range
    // to 70-100 keeps a gentle preference for affordability as a
    // tiebreaker without letting it override real fit/quality
    // differences elsewhere.
    const headroomFraction = 1 - lens.price / maxBudget; // 0 (at budget) .. 1 (free)
    rawScore =
      IN_BUDGET_SCORE_FLOOR + headroomFraction * (IN_BUDGET_SCORE_CEILING - IN_BUDGET_SCORE_FLOOR);
  } else {
    // Over budget: half credit, scaled by how far over.
    rawScore = (maxBudget / lens.price) * 100 * 0.5;
  }

  return rawScore * SCORING_WEIGHTS.BUDGET;
}

/** 0-30 points: how well the lens suits the requested astro type. */
export function scoreAstroFit({ lens, preferredType }: ScoringInput): number {
  // No preference given -> don't penalize, treat as a full match.
  if (!preferredType) {
    return MAX_SCORE.ASTRO_FIT;
  }

  const preferredLabel = ASTRO_TYPE_LABELS[preferredType];
  const isDirectMatch = lens.idealUseCase.includes(preferredLabel);

  let rawScore: number; // 0-100 scale before weighting
  if (isDirectMatch) {
    // Among lenses that already match the requested astro type, reward
    // better optical quality for astro use. comaRating/cornerSharpness are
    // seeded per-lens (1-5) but previously went unused entirely, so two
    // lenses with the same tag always tied here -- "Deep Sky should
    // prioritize lower coma" only appeared to work because the catalog has
    // just one Deep-Sky lens per mount (Week 3 Wed-Thu report). Mapped onto
    // a 76-100 band so a direct match still always beats the "versatile"
    // (70) and "unrelated" (20) tiers below, even at the worst rating.
    const qualityRating = (lens.comaRating + lens.cornerSharpness) / 2; // 1-5
    rawScore = 70 + qualityRating * 6; // 76 (rating 1) .. 100 (rating 5)
  } else if (lens.idealUseCase.length > 1) {
    // Lens is versatile across multiple use cases -> can still work.
    rawScore = 70;
  } else {
    // Lens is specialized for something else entirely.
    rawScore = 20;
  }

  return rawScore * SCORING_WEIGHTS.ASTRO_FIT;
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
