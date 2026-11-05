import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("../claude/client", () => ({
  claude: { messages: { create: createMock } },
  CLAUDE_MODEL: "claude-opus-5",
}));

const {
  generateExplanation,
  buildExplanationCacheKey,
  buildExplanationPrompt,
  clearExplanationCache,
} = await import("./explanationGenerator");
const Anthropic = (await import("@anthropic-ai/sdk")).default;

const rokinon = {
  id: "lens_1",
  name: "14mm f/2.8",
  brand: "Rokinon",
  price: 349,
  idealUseCase: ["Deep Sky"],
};

const baseInput = {
  lens: rokinon,
  budget: 450,
  astroType: "DEEPSKY" as const,
  experienceLevel: "BEGINNER" as const,
};

describe("buildExplanationCacheKey", () => {
  it("buckets nearby budgets into the same key", () => {
    const keyA = buildExplanationCacheKey({ ...baseInput, budget: 310 });
    const keyB = buildExplanationCacheKey({ ...baseInput, budget: 590 });
    expect(keyA).toBe(keyB);
  });

  it("differs when the lens, astro type, or experience level differs", () => {
    const base = buildExplanationCacheKey(baseInput);
    expect(buildExplanationCacheKey({ ...baseInput, lens: { ...rokinon, id: "lens_2" } })).not.toBe(
      base
    );
    expect(buildExplanationCacheKey({ ...baseInput, astroType: "LUNAR" })).not.toBe(base);
    expect(
      buildExplanationCacheKey({ ...baseInput, experienceLevel: "INTERMEDIATE" })
    ).not.toBe(base);
  });

  it("treats a missing astroType/experienceLevel as its own bucket", () => {
    const key = buildExplanationCacheKey({
      lens: rokinon,
      budget: 450,
      astroType: undefined,
      experienceLevel: undefined,
    });
    expect(key).toContain("general astrophotography");
    expect(key).toContain("unspecified experience");
  });
});

describe("buildExplanationPrompt", () => {
  it("mentions the lens, astro type, and budget tier", () => {
    const prompt = buildExplanationPrompt(baseInput);
    expect(prompt).toContain("Rokinon 14mm f/2.8");
    expect(prompt).toContain("Deep Sky");
    expect(prompt).toContain("$300-600");
    expect(prompt).toContain("good choice");
  });

  it("asks for an honest answer instead of a sales pitch when the lens isn't tagged for the type", () => {
    const prompt = buildExplanationPrompt({ ...baseInput, astroType: "LUNAR" });
    expect(prompt).toContain("not a dedicated Lunar lens");
    expect(prompt).not.toContain("good choice");
  });

  it("treats a request with no astro type as a normal match", () => {
    const prompt = buildExplanationPrompt({ ...baseInput, astroType: undefined });
    expect(prompt).toContain("good choice");
  });
});

describe("generateExplanation", () => {
  beforeEach(() => {
    createMock.mockReset();
    clearExplanationCache();
  });

  it("returns Claude's text response and passes low effort + a request timeout", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Great budget pick for deep sky work." }],
    });

    const result = await generateExplanation(baseInput);

    expect(result).toBe("Great budget pick for deep sky work.");
    expect(createMock).toHaveBeenCalledTimes(1);
    const [params, options] = createMock.mock.calls[0];
    expect(params.output_config).toEqual({ effort: "low" });
    expect(options).toEqual({ timeout: 10_000 });
  });

  it("caches the result and skips a second Claude call for the same bucketed input", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Cached explanation." }],
    });

    const first = await generateExplanation(baseInput);
    const second = await generateExplanation({ ...baseInput, budget: 599 }); // same budget tier

    expect(first).toBe("Cached explanation.");
    expect(second).toBe("Cached explanation.");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a deterministic explanation on rate limit errors, without throwing", async () => {
    createMock.mockRejectedValue(
      new Anthropic.RateLimitError(429, {}, "rate limited", new Headers())
    );

    const result = await generateExplanation(baseInput);

    expect(result).toContain("Rokinon 14mm f/2.8");
    expect(result).toContain("$300-600");
  });

  it("doesn't claim the lens suits the astro type in the fallback when it isn't tagged for it", async () => {
    createMock.mockRejectedValue(new Error("network blip"));

    const result = await generateExplanation({ ...baseInput, astroType: "LUNAR" });

    expect(result).toContain("isn't a dedicated Lunar lens");
    expect(result).not.toContain("suits");
  });

  it("falls back to a deterministic explanation on a timeout", async () => {
    createMock.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());

    const result = await generateExplanation(baseInput);

    expect(result).toContain("Rokinon 14mm f/2.8");
  });

  it("falls back to a deterministic explanation on a generic API error", async () => {
    createMock.mockRejectedValue(
      new Anthropic.InternalServerError(500, {}, "server error", new Headers())
    );

    const result = await generateExplanation(baseInput);

    expect(result).toContain("Rokinon 14mm f/2.8");
  });

  it("falls back when Claude returns no usable text block", async () => {
    createMock.mockResolvedValue({ content: [] });

    const result = await generateExplanation(baseInput);

    expect(result).toContain("Rokinon 14mm f/2.8");
  });

  it("does not cache the fallback explanation from a failed request", async () => {
    createMock.mockRejectedValueOnce(new Error("network blip"));
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "Recovered explanation." }],
    });

    const first = await generateExplanation(baseInput);
    const second = await generateExplanation(baseInput);

    expect(first).not.toBe("Recovered explanation.");
    expect(second).toBe("Recovered explanation.");
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
