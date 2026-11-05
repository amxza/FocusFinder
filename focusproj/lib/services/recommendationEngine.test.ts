import { beforeEach, describe, expect, it, vi } from "vitest";

const { findCandidateLenses, generateExplanation, findUnique, create } = vi.hoisted(() => ({
  findCandidateLenses: vi.fn(),
  generateExplanation: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: { searchSession: { findUnique, create } },
}));
vi.mock("./lensQuery", () => ({ findCandidateLenses }));
vi.mock("./explanationGenerator", () => ({ generateExplanation }));

const { generateRecommendations, getSearchSessionById, rankLenses } = await import(
  "./recommendationEngine"
);

function makeLens(name: string, lensMount: string, price: number) {
  return {
    id: `${name}-${lensMount}`,
    name,
    lensMount,
    price,
    idealUseCase: ["Milky Way"],
    comaRating: 4,
    cornerSharpness: 4,
    manualFocusQuality: "",
    maxAperture: 2.8,
    commonMistakes: [],
    averageReviewScore: 4,
    reviews: [],
  };
}

const REVIEWS_INCLUDE = {
  lensRecommendations: { include: { lens: { include: { reviews: true } } } },
};

beforeEach(() => {
  findCandidateLenses.mockReset();
  generateExplanation.mockReset();
  findUnique.mockReset();
  create.mockReset();
});

describe("rankLenses", () => {
  it("returns each lens once when it has a row per mount", async () => {
    findCandidateLenses.mockResolvedValue([
      makeLens("Lens A", "SONYE", 100),
      makeLens("Lens A", "NIKONF", 100),
      makeLens("Lens A", "CANONEF", 100),
      makeLens("Lens B", "SONYE", 200),
      makeLens("Lens B", "NIKONF", 200),
    ]);

    const ranked = await rankLenses({ budget: 500 });

    expect(ranked.map((r) => r.lens.name)).toEqual(["Lens A", "Lens B"]);
  });

  it("removes duplicates before the top 5 cut so distinct lenses fill the slots", async () => {
    const duplicates = ["SONYE", "NIKONF", "NIKONZ", "CANONEF", "CANONRF"].map((mount) =>
      makeLens("Cheapest", mount, 100)
    );
    const others = ["B", "C", "D", "E", "F"].map((name, i) =>
      makeLens(name, "SONYE", 200 + i * 50)
    );
    findCandidateLenses.mockResolvedValue([...duplicates, ...others]);

    const ranked = await rankLenses({ budget: 500 });

    expect(ranked.map((r) => r.lens.name)).toEqual(["Cheapest", "B", "C", "D", "E"]);
  });
});

describe("generateRecommendations", () => {
  it("returns the created recommendations ordered by rank", async () => {
    findCandidateLenses.mockResolvedValue([makeLens("Lens A", "SONYE", 100)]);
    generateExplanation.mockResolvedValue("Because.");
    create.mockResolvedValue({ id: "session_1", recommendations: [] });

    await generateRecommendations({ customerId: "cust_1", budget: 500 });

    expect(create.mock.calls[0][0].include.recommendations.orderBy).toEqual({ rank: "asc" });
  });
});

describe("reviews in API results", () => {
  it("loads reviews with each recommended lens on POST", async () => {
    findCandidateLenses.mockResolvedValue([makeLens("Lens A", "SONYE", 100)]);
    generateExplanation.mockResolvedValue("Because.");
    create.mockResolvedValue({ id: "session_1", recommendations: [] });

    await generateRecommendations({ customerId: "cust_1", budget: 500 });

    expect(create.mock.calls[0][0].include.recommendations.include).toEqual(REVIEWS_INCLUDE);
  });

  it("loads and returns reviews with each recommended lens on GET", async () => {
    const reviews = [{ id: "review_1", quote: "Great coma control" }];
    findUnique.mockResolvedValue({
      id: "session_1",
      recommendations: [
        {
          rank: 1,
          aiExplain: "Because.",
          lensRecommendations: [{ lens: { ...makeLens("Lens A", "SONYE", 100), reviews } }],
        },
      ],
    });

    const result = await getSearchSessionById("session_1");

    expect(findUnique.mock.calls[0][0].include.recommendations.include).toEqual(REVIEWS_INCLUDE);
    expect(result?.recommendations[0].lens?.reviews).toEqual(reviews);
  });
});
