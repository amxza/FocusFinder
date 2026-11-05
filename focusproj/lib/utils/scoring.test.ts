import { describe, expect, it } from "vitest";
import { MAX_SCORE } from "./constants";
import {
  longestFocalLengthMm,
  scoreFieldQuality,
  scoreBudgetMatch,
  scoreCredibility,
  scoreExperience,
  scoreLens,
  type ScoringInput,
} from "./scoring";

// Week 2 Wed-Thu's plan checkbox claimed these existed; they never actually
// landed in the repo. Added now (Week 3 Wed-Thu follow-up) alongside the
// budget and astro-fit rework described in the data validation report, so the
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

  it("gives full credit to any lens using at least half the budget", () => {
    for (const price of [500, 750, 1000]) {
      const score = scoreBudgetMatch({ lens: makeLens({ price }), maxBudget: 1000 });
      expect(score).toBeCloseTo(MAX_SCORE.BUDGET, 5);
    }
  });

  it("gives a free lens 70% credit", () => {
    const score = scoreBudgetMatch({ lens: makeLens({ price: 0 }), maxBudget: 1000 });
    expect(score).toBeCloseTo(10.5, 5); // 70 * 0.15
  });

  it("raises the score steadily up to half the budget", () => {
    const scores = [0, 250, 500].map((price) =>
      scoreBudgetMatch({ lens: makeLens({ price }), maxBudget: 1000 })
    );
    expect(scores[1]).toBeGreaterThan(scores[0]);
    expect(scores[2]).toBeGreaterThan(scores[1]);
  });

  it("scores a lens over budget below every lens within budget", () => {
    const over = scoreBudgetMatch({ lens: makeLens({ price: 1001 }), maxBudget: 1000 });
    const free = scoreBudgetMatch({ lens: makeLens({ price: 0 }), maxBudget: 1000 });
    expect(over).toBeCloseTo(4.5, 5); // 30 * 0.15
    expect(over).toBeLessThan(free);
  });

  it("never separates two in-budget lenses by more than 4.5 points", () => {
    const free = scoreBudgetMatch({ lens: makeLens({ price: 0 }), maxBudget: 1000 });
    const full = scoreBudgetMatch({ lens: makeLens({ price: 1000 }), maxBudget: 1000 });
    expect(full - free).toBeCloseTo(4.5, 5);
  });
});

describe("scoreFieldQuality", () => {
  const field = (preferredType: ScoringInput["preferredType"], overrides: Partial<TestLens>) =>
    scoreFieldQuality({ lens: makeLens(overrides), maxBudget: 1000, preferredType });

  const bestOptics = { maxAperture: 1.4, comaRating: 5, cornerSharpness: 5 };
  const worstOptics = { maxAperture: 11, comaRating: 1, cornerSharpness: 1 };

  it("gives the full 50 points to an ideal Milky Way lens", () => {
    expect(field("MILKYWAY", { ...bestOptics, focalLength: "14mm" })).toBeCloseTo(
      MAX_SCORE.FIELD_QUALITY,
      5
    );
  });

  it("rates lenses on general optics when no field is requested", () => {
    const sharpFast = field(undefined, { ...bestOptics, idealUseCase: ["Lunar"] });
    const softSlow = field(undefined, { ...worstOptics, idealUseCase: ["Lunar"] });
    expect(sharpFast).toBeCloseTo(MAX_SCORE.FIELD_QUALITY, 5);
    expect(softSlow).toBeCloseTo(25, 5); // the tagged floor
  });

  for (const [preferredType, label] of [
    ["MILKYWAY", "Milky Way"],
    ["DEEPSKY", "Deep Sky"],
    ["PLANETS", "Planetary"],
    ["LUNAR", "Lunar"],
  ] as const) {
    it(`ranks any lens tagged ${label} above any untagged lens`, () => {
      const worstTagged = field(preferredType, { ...worstOptics, focalLength: "50mm", idealUseCase: [label] });
      const bestUntagged = field(preferredType, { ...bestOptics, focalLength: "14-800mm", idealUseCase: ["Other"] });
      expect(worstTagged).toBeGreaterThan(bestUntagged);
    });
  }

  it("favors faster, wider lenses for Milky Way", () => {
    const fastWide = field("MILKYWAY", { maxAperture: 1.4, focalLength: "14mm" });
    const slowNormal = field("MILKYWAY", { maxAperture: 2.8, focalLength: "24mm" });
    expect(fastWide).toBeGreaterThan(slowNormal);
  });

  it("favors lower coma for Milky Way", () => {
    expect(field("MILKYWAY", { comaRating: 5 })).toBeGreaterThan(field("MILKYWAY", { comaRating: 3 }));
  });

  it("ranks a sharp, low-coma 135mm f/2 above a 200mm f/2.8 for Deep Sky", () => {
    const rokinon135 = field("DEEPSKY", {
      idealUseCase: ["Deep Sky"],
      focalLength: "135mm",
      maxAperture: 2,
      comaRating: 5,
      cornerSharpness: 5,
    });
    const canon200 = field("DEEPSKY", {
      idealUseCase: ["Deep Sky"],
      focalLength: "200mm",
      maxAperture: 2.8,
      comaRating: 4,
      cornerSharpness: 4,
    });
    expect(rokinon135).toBeGreaterThan(canon200);
  });

  for (const [preferredType, label] of [
    ["PLANETS", "Planetary"],
    ["LUNAR", "Lunar"],
  ] as const) {
    describe(`reach for ${preferredType}`, () => {
      const score = (focalLength: string, idealUseCase: string[]) =>
        field(preferredType, { focalLength, idealUseCase });

      it("ranks longer tagged lenses higher", () => {
        expect(score("150-600mm", [label])).toBeGreaterThan(score("100-400mm", [label]));
      });

      it("ranks longer untagged lenses higher when nothing tagged is available", () => {
        expect(score("200mm", ["Deep Sky"])).toBeGreaterThan(score("14mm", ["Milky Way"]));
      });

      it("gives no credit for having several unrelated tags", () => {
        expect(score("85mm", ["Deep Sky", "Milky Way"])).toBe(score("85mm", ["Deep Sky"]));
      });
    });
  }
});

describe("longestFocalLengthMm", () => {
  it("reads primes and zooms", () => {
    expect(longestFocalLengthMm("14mm")).toBe(14);
    expect(longestFocalLengthMm("150-600mm")).toBe(600);
  });

  it("returns 0 when there is no number to read", () => {
    expect(longestFocalLengthMm("unknown")).toBe(0);
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

  const credibility = (averageReviewScore: number, sources: (string | null)[]) =>
    scoreCredibility({
      lens: makeLens({
        averageReviewScore,
        reviews: sources.map((source) => ({ source }) as never),
      }),
      maxBudget: 1000,
    });

  it("scores the average rating on its own at 20 raw points per star", () => {
    expect(credibility(3, [])).toBeCloseTo(9, 5); // 3*20 = 60, * 0.15
  });

  it("adds 10 raw points for each review", () => {
    const one = credibility(2, ["REDDIT"]); // 40 + 10 + 5 = 55
    const two = credibility(2, ["REDDIT", "REDDIT"]); // 40 + 20 + 5 = 65
    expect(two - one).toBeCloseTo(1.5, 5); // 10 * 0.15
  });

  it("counts each distinct source once, so a second outlet beats a second review from the same one", () => {
    const sameSource = credibility(2, ["REDDIT", "REDDIT"]); // 40 + 20 + 5 = 65
    const twoSources = credibility(2, ["REDDIT", "ASTROBACKYARD"]); // 40 + 20 + 10 = 70
    expect(sameSource).toBeCloseTo(9.75, 5);
    expect(twoSources).toBeCloseTo(10.5, 5);
  });

  it("counts a review with no source as a review but not as a source", () => {
    expect(credibility(2, [null])).toBeCloseTo(7.5, 5); // 40 + 10 + 0 = 50
  });

  it("treats a lens with no reviews loaded as having none", () => {
    const lens = makeLens({ averageReviewScore: 3, reviews: undefined as never });
    expect(scoreCredibility({ lens, maxBudget: 1000 })).toBeCloseTo(9, 5);
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
      breakdown.fieldQuality + breakdown.experience + breakdown.budget + breakdown.credibility,
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
    expect(breakdown.budget).toBeLessThanOrEqual(MAX_SCORE.BUDGET);
    expect(breakdown.fieldQuality).toBeLessThanOrEqual(MAX_SCORE.FIELD_QUALITY);
    expect(breakdown.experience).toBeLessThanOrEqual(20);
    expect(breakdown.credibility).toBeLessThanOrEqual(15);
    expect(breakdown.total).toBeLessThanOrEqual(100);
  });
});
