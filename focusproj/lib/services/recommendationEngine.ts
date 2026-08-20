import { prisma } from "../prisma";
import { findCandidateLenses } from "./lensQuery";
import { scoreLens } from "../utils/scoring";
import { TOP_N_RECOMMENDATIONS } from "../utils/constants";
import type { astroType, ExperienceLevel, Mount } from "../../generated/prisma/enums";

export interface RecommendationRequest {
  customerId: string;
  mount?: Mount;
  astroType?: astroType;
  budget: number;
  experienceLevel?: ExperienceLevel;
}

export interface RankedLens {
  lensId: string;
  score: number;
  breakdown: ReturnType<typeof scoreLens>;
}

/**
 * Core recommendation engine (Week 2, Wed-Thu). Filters candidate lenses,
 * scores each one, and returns the top N ranked by score.
 *
 * Currently returns zero-score stubs until lib/utils/scoring.ts is filled
 * in from the algorithm spec.
 */
export async function rankLenses(
  input: Omit<RecommendationRequest, "customerId">
): Promise<RankedLens[]> {
  const candidates = await findCandidateLenses({
    mount: input.mount,
    maxBudget: input.budget,
    astroType: input.astroType,
  });

  const ranked = candidates.map((lens) => {
    const breakdown = scoreLens({
      lens,
      maxBudget: input.budget,
      preferredType: input.astroType,
      experienceLevel: input.experienceLevel,
    });
    return { lensId: lens.id, score: breakdown.total, breakdown };
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N_RECOMMENDATIONS);
}

/**
 * Runs the ranking, then persists a SearchSession + Recommendation records
 * so the results can be fetched later via GET /api/recommendations/:id.
 */
export async function generateRecommendations(input: RecommendationRequest) {
  const ranked = await rankLenses(input);

  const searchSession = await prisma.searchSession.create({
    data: {
      customerId: input.customerId,
      preferredType: input.astroType,
      preferredMount: input.mount,
      maxBudget: input.budget,
      experienceLevel: input.experienceLevel,
      recommendations: {
        create: ranked.map((r, index) => ({
          rank: index + 1,
          // TODO (Week 3): replace with Claude-generated explanation
          aiExplain: "",
          lensRecommendations: {
            create: [{ lensId: r.lensId }],
          },
        })),
      },
    },
    include: {
      recommendations: {
        include: { lensRecommendations: { include: { lens: true } } },
      },
    },
  });

  return searchSession;
}
