import { describe, expect, it } from "vitest";
import {
  scoreAstroFit,
  scoreBudgetMatch,
  scoreCredibility,
  scoreExperience,
  scoreLens,
  type ScoringInput,
} from "./scoring";

// Week 2 Wed-Thu's plan checkbox claimed these existed; they never actually
// landed in the repo. Added now (Week 3 Wed-Thu follow-up) alongside the
// budget/astro-fit rework described in the data validation report, so the
// fix has regression coverage from the start.

type TestLens = ScoringInput["lens"];

function makeLens(overrides: Partial<TestLens> = {}): TestLens {
  return {
    id: "lens_1",
    name: "Test Lens",
    brand: "TestBrand",
    lensMount: "SONYE",
    focalLength: "24mm",
    maxAperture: 2.8,
    price: 500,
    imageUrl: null,
    comaRating: 3,
    cornerSharpness: 3,
    manualFocusQuality: "Smooth mechanical focus ring with a hard stop at infinity",
    idealUseCase: ["Milky Way"],
    redditConsensusUrl: [],
    averageReviewScore: 0,
    commonMistakes: [],
    comparisonNotes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    reviews: [],
    ...overrides,
  } as TestLens;
}

describe("scoreBudgetMatch", () => {
  it("returns 0 when maxBudget is not positive", () => {
    expect(scoreBudgetMatch({ lens: makeLens(), maxBudget: 0 })).toBe(0);
    expect(scoreBudgetMatch({ lens: makeLens(), maxBudget: -100 })).toBe(0);
  });

  it("gives the maximum score to a free lens", () => {
    const score = scoreBudgetMatch({ lens: makeLens({ price: 0 }), maxBudget: 1000 });
    expect(score).toBeCloseTo(35, 5); // 100 * 0.35
  });

  it("gives the compressed floor score to a lens priced exactly at the budget", () => {
    const score = scoreBudgetMatch({ lens: makeLens({ price: 1000 }), maxBudget: 1000 });
    expect(score).toBeCloseTo(24.5, 5); // 70 * 0.35
  });

  it("keeps the in-budget range within [70, 100] pre-weight (i.e. [24.5, 35] weighted)", () => {
    for (const price of [1, 100, 500, 999, 1000]) {
      const score = scoreBudgetMatch({ lens: makeLens({ price }), maxBudget: 1000 });
      expect(score).toBeGreaterThanOrEqual(24.5 - 1e-9);
      expect(score).toBeLessThanOrEqual(35 + 1e-9);
    }
  });

  it("still gives cheaper lenses a higher score than pricier ones (mild tiebreaker, not dominant)", () => {
    const cheap = scoreBudgetMatch({ lens: makeLens({ price: 200 }), maxBudget: 1500 });
    const pricey = scoreBudgetMatch({ lens: makeLens({ price: 999 }), maxBudget: 1500 });
    expect(cheap).toBeGreaterThan(pricey);
    // The whole point of the rework: this gap should be small enough for
    // astro-fit/experience/credibility to realistically overcome it, not
    // the ~18.6-point gap the old (1 - price/maxBudget) formula produced.
    expect(cheap - pricey).toBeLessThan(10);
  });

  it("gives half credit (scaled down) for a lens over budget", () => {
    const justOver = scoreBudgetMatch({ lens: makeLens({ price: 1100 }), maxBudget: 1000 });
    const wayOver = scoreBudgetMatch({ lens: makeLens({ price: 2000 }), maxBudget: 1000 });
    expect(justOver).toBeGreaterThan(0);
    expect(justOver).toBeLessThan(wayOver === 0 ? Infinity : 35);
    expect(wayOver).toBeLessThan(justOver);
  });

  it("scores an at-budget lens higher than one priced just over budget", () => {
    const atBudget = scoreBudgetMatch({ lens: makeLens({ price: 1000 }), maxBudget: 1000 });
    const justOver = scoreBudgetMatch({ lens: makeLens({ price: 1001 }), maxBudget: 1000 });
    expect(atBudget).toBeGreaterThan(justOver);
  });
});

describe("scoreAstroFit", () => {
  it("returns the max score when no astro type is preferred", () => {
    const score = scoreAstroFit({
      lens: makeLens({ idealUseCase: ["Lunar"] }),
      maxBudget: 1000,
      preferredType: undefined,
    });
    expect(score).toBe(30);
  });

  it("rewards better coma/corner-sharpness among direct matches", () => {
    const bestQuality = scoreAstroFit({
      lens: makeLens({ idealUseCase: ["Deep Sky"], comaRating: 5, cornerSharpness: 5 }),
      maxBudget: 1000,
      preferredType: "DEEPSKY",
    });
    const worstQuality = scoreAstroFit({
      lens: makeLens({ idealUseCase: ["Deep Sky"], comaRating: 1, cornerSharpness: 1 }),
      maxBudget: 1000,
      preferredType: "DEEPSKY",
    });
    expect(bestQuality).toBeCloseTo(30, 5); // (70 + 5*6) * 0.3
    expect(worstQuality).toBeCloseTo(22.8, 5); // (70 + 1*6) * 0.3
    expect(bestQuality).toBeGreaterThan(worstQuality);
  });

  it("still ranks a direct match above a versatile match even at the worst quality rating", () => {
    const worstDirectMatch = scoreAstroFit({
      lens: makeLens({ idealUseCase: ["Deep Sky"], comaRating: 1, cornerSharpness: 1 }),
      maxBudget: 1000,
      preferredType: "DEEPSKY",
    });
    const versatile = scoreAstroFit({
      lens: makeLens({ idealUseCase: ["Milky Way", "Deep Sky adjacent"] }),
      maxBudget: 1000,
      preferredType: "LUNAR",
    });
    expect(worstDirectMatch).toBeGreaterThan(versatile);
  });

  it("gives partial credit to a versatile (multi-tag, non-matching) lens", () => {
    const score = scoreAstroFit({
      lens: makeLens({ idealUseCase: ["Milky Way", "Lunar"] }),
      maxBudget: 1000,
      preferredType: "DEEPSKY",
    });
    expect(score).toBeCloseTo(21, 5); // 70 * 0.3
  });

  it("gives low credit to a lens specialized for something else entirely", () => {
    const score = scoreAstroFit({
      lens: makeLens({ idealUseCase: ["Milky Way"] }),
      maxBudget: 1000,
      preferredType: "PLANETS",
    });
    expect(score).toBeCloseTo(6, 5); // 20 * 0.3
  });
});

describe("scoreExperience", () => {
  const easyLens = makeLens({
    maxAperture: 4,
    manualFocusQuality: "Smooth mechanical ring with a hard stop at infinity",
    commonMistakes: [],
  });

  it("gives the max score for intermediate experience regardless of lens attributes", () => {
    const hardLens = makeLens({
      maxAperture: 1.4,
      manualFocusQuality: "focus-by-wire ring with no distance markings",
      commonMistakes: ["Easy to rack past infinity"],
    });
    expect(scoreExperience({ lens: easyLens, maxBudget: 1000, experienceLevel: "INTERMEDIATE" })).toBe(20);
    expect(scoreExperience({ lens: hardLens, maxBudget: 1000, experienceLevel: "INTERMEDIATE" })).toBe(20);
  });

  it("gives the max score for unspecified experience", () => {
    expect(scoreExperience({ lens: easyLens, maxBudget: 1000, experienceLevel: undefined })).toBe(20);
  });

  it("gives beginners the max score for a lens with none of the difficulty flags", () => {
    expect(scoreExperience({ lens: easyLens, maxBudget: 1000, experienceLevel: "BEGINNER" })).toBe(20);
  });

  it("penalizes beginners for a fast (<=f/2) aperture", () => {
    const fastLens = makeLens({ maxAperture: 1.8 });
    const score = scoreExperience({ lens: fastLens, maxBudget: 1000, experienceLevel: "BEGINNER" });
    expect(score).toBeCloseTo((100 - 15) * 0.2, 5);
  });

  it("penalizes beginners for focus-by-wire with no hard stop", () => {
    const fiddlyLens = makeLens({
      manualFocusQuality: "focus-by-wire ring, rotating continuously with no physical end limits",
    });
    const score = scoreExperience({ lens: fiddlyLens, maxBudget: 1000, experienceLevel: "BEGINNER" });
    expect(score).toBeCloseTo((100 - 20) * 0.2, 5);
  });

  it("does not penalize focus-by-wire when a hard stop/distance scale is documented", () => {
    const lens = makeLens({ manualFocusQuality: "focus-by-wire ring with a distance scale" });
    expect(scoreExperience({ lens, maxBudget: 1000, experienceLevel: "BEGINNER" })).toBe(20);
  });

  it("penalizes beginners for documented common mistakes", () => {
    const lens = makeLens({ commonMistakes: ["Don't rely on autofocus"] });
    const score = scoreExperience({ lens, maxBudget: 1000, experienceLevel: "BEGINNER" });
    expect(score).toBeCloseTo((100 - 25) * 0.2, 5);
  });

  it("stacks all three beginner penalties (20 + 15 + 25 = 60 off a 100 base)", () => {
    const hardLens = makeLens({
      maxAperture: 1.4,
      manualFocusQuality: "focus-by-wire ring, rotating continuously with no physical end limits",
      commonMistakes: ["Easy to rack past infinity", "Needs a tripod"],
    });
    const score = scoreExperience({ lens: hardLens, maxBudget: 1000, experienceLevel: "BEGINNER" });
    expect(score).toBeCloseTo((100 - 20 - 15 - 25) * 0.2, 5); // 8
    // The 3 penalties (20+15+25=60) can never exceed the 100 base today, so
    // Math.max(0, rawScore) in the implementation is defensive/unreachable
    // with current penalty values -- this just documents that headroom.
    expect(score).toBeGreaterThan(0);
  });
});

describe("scoreCredibility", () => {
  it("returns 0 for a lens with no reviews and no average score", () => {
    const score = scoreCredibility({ lens: makeLens({ reviews: [], averageReviewScore: 0 }), maxBudget: 1000 });
    expect(score).toBe(0);
  });

  it("scores higher with a better average rating, more reviews, and more distinct sources", () => {
    const lens = makeLens({
      averageReviewScore: 4.5,
      reviews: [
        { source: "REDDIT" } as never,
        { source: "ASTROBACKYARD" } as never,
      ],
    });
    const score = scoreCredibility({ lens, maxBudget: 1000 });
    // (4.5*20 + 2*10 + 2*5) = 120, clamped to 100, * 0.15
    expect(score).toBeCloseTo(15, 5);
  });

  it("caps the raw score at 100 before weighting", () => {
    const lens = makeLens({
      averageReviewScore: 5,
      reviews: Array.from({ length: 10 }, (_, i) => ({ source: `SOURCE_${i}` }) as never),
    });
    const score = scoreCredibility({ lens, maxBudget: 1000 });
    expect(score).toBeCloseTo(15, 5); // still capped at MAX_SCORE.CREDIBILITY
  });
});

describe("scoreLens", () => {
  it("returns a total equal to the sum of the four component scores", () => {
    const input: ScoringInput = {
      lens: makeLens({ price: 300, idealUseCase: ["Milky Way"], comaRating: 4, cornerSharpness: 4 }),
      maxBudget: 500,
      preferredType: "MILKYWAY",
      experienceLevel: "BEGINNER",
    };
    const breakdown = scoreLens(input);
    expect(breakdown.total).toBeCloseTo(
      breakdown.budget + breakdown.astroFit + breakdown.experience + breakdown.credibility,
      5
    );
  });

  it("keeps every component within its documented max", () => {
    const input: ScoringInput = {
      lens: makeLens({ price: 0, idealUseCase: ["Milky Way"], comaRating: 5, cornerSharpness: 5, averageReviewScore: 5 }),
      maxBudget: 1000,
      preferredType: "MILKYWAY",
      experienceLevel: "INTERMEDIATE",
    };
    const breakdown = scoreLens(input);
    expect(breakdown.budget).toBeLessThanOrEqual(35);
    expect(breakdown.astroFit).toBeLessThanOrEqual(30);
    expect(breakdown.experience).toBeLessThanOrEqual(20);
    expect(breakdown.credibility).toBeLessThanOrEqual(15);
    expect(breakdown.total).toBeLessThanOrEqual(100);
  });
});
