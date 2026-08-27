import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSearchSessionById } = vi.hoisted(() => ({
  getSearchSessionById: vi.fn(),
}));

vi.mock("../../../../lib/services/recommendationEngine", () => ({
  getSearchSessionById,
}));

const { GET } = await import("./route");

function makeCtx(searchSessionId: unknown) {
  return {
    params: Promise.resolve({ searchSessionId }),
  } as unknown as Parameters<typeof GET>[1];
}

describe("GET /api/recommendations/:searchSessionId", () => {
  beforeEach(() => {
    getSearchSessionById.mockReset();
  });

  it("returns 400 when searchSessionId is blank", async () => {
    const response = await GET(new Request("http://localhost"), makeCtx("   "));

    expect(response.status).toBe(400);
    expect(getSearchSessionById).not.toHaveBeenCalled();
  });

  it("returns 200 with the shaped session when found", async () => {
    getSearchSessionById.mockResolvedValue({
      searchSessionId: "session_1",
      recommendations: [
        { rank: 1, aiExplain: "Great value pick.", lens: { id: "lens_1" } },
      ],
    });

    const response = await GET(new Request("http://localhost"), makeCtx("session_1"));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.searchSessionId).toBe("session_1");
    expect(json.recommendations).toHaveLength(1);
    expect(getSearchSessionById).toHaveBeenCalledWith("session_1");
  });

  it("returns 404 when no session matches the id", async () => {
    getSearchSessionById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), makeCtx("missing"));

    expect(response.status).toBe(404);
  });

  it("returns 500 when the service throws", async () => {
    getSearchSessionById.mockRejectedValue(new Error("db is down"));

    const response = await GET(new Request("http://localhost"), makeCtx("session_1"));

    expect(response.status).toBe(500);
  });
});
