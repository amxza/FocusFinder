import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateRecommendations } = vi.hoisted(() => ({
  generateRecommendations: vi.fn(),
}));

vi.mock("../../../lib/services/recommendationEngine", () => ({
  generateRecommendations,
}));

vi.mock("../../../generated/prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.code = code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

const { POST } = await import("./route");
const { Prisma } = await import("../../../generated/prisma/client");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/questionnaire", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/questionnaire", () => {
  beforeEach(() => {
    generateRecommendations.mockReset();
  });

  it("returns 400 with error details for an invalid payload", async () => {
    const response = await POST(makeRequest({ mount: "NOT_REAL" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(Array.isArray(json.error)).toBe(true);
    expect(generateRecommendations).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const badRequest = new Request("http://localhost/api/questionnaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    const response = await POST(badRequest);
    expect(response.status).toBe(400);
    expect(generateRecommendations).not.toHaveBeenCalled();
  });

  it("returns 201 with searchSessionId + recommendations for a valid payload", async () => {
    generateRecommendations.mockResolvedValue({
      id: "session_1",
      recommendations: [{ rank: 1, aiExplain: "" }],
    });

    const response = await POST(
      makeRequest({
        customerId: "cust_123",
        mount: "NIKONF",
        astroType: "DEEPSKY",
        budget: 600,
        experienceLevel: "BEGINNER",
      })
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.searchSessionId).toBe("session_1");
    expect(json.recommendations).toEqual([{ rank: 1, aiExplain: "" }]);
    expect(generateRecommendations).toHaveBeenCalledWith({
      customerId: "cust_123",
      mount: "NIKONF",
      astroType: "DEEPSKY",
      budget: 600,
      experienceLevel: "BEGINNER",
    });
  });

  it("returns 404 when customerId does not reference an existing customer", async () => {
    generateRecommendations.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("FK violation", {
        code: "P2003",
        clientVersion: "test",
      })
    );

    const response = await POST(
      makeRequest({ customerId: "does_not_exist", budget: 300 })
    );

    expect(response.status).toBe(404);
  });

  it("returns 500 for unexpected errors", async () => {
    generateRecommendations.mockRejectedValue(new Error("db is down"));

    const response = await POST(
      makeRequest({ customerId: "cust_123", budget: 300 })
    );

    expect(response.status).toBe(500);
  });
});
