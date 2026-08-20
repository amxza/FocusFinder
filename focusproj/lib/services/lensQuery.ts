import { prisma } from "../prisma";
import type { astroType, Mount } from "../../generated/prisma/enums";

export interface LensFilter {
  mount?: Mount;
  maxBudget?: number;
  astroType?: astroType;
}

/**
 * Fetches candidate lenses for the recommendation engine, filtered by
 * mount + budget. Astro-type filtering happens in the scoring step since
 * it's a fit score rather than a hard cutoff.
 */
export async function findCandidateLenses(filter: LensFilter) {
  return prisma.lens.findMany({
    where: {
      ...(filter.mount ? { lensMount: filter.mount } : {}),
      ...(filter.maxBudget
        ? { price: { lte: filter.maxBudget * 1.1 } } // small over-budget allowance; real cutoff handled in scoring
        : {}),
    },
    include: {
      reviews: true,
    },
  });
}

export async function getLensById(id: string) {
  return prisma.lens.findUnique({
    where: { id },
    include: { reviews: true },
  });
}

export async function listLenses() {
  return prisma.lens.findMany({
    orderBy: { name: "asc" },
  });
}
