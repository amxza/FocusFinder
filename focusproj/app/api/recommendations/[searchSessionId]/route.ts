import { NextResponse } from "next/server";
import { getSearchSessionById } from "../../../../lib/services/recommendationEngine";
import { validateSearchSessionId } from "../../../../lib/utils/validation";

// GET /api/recommendations/:searchSessionId
// Returns: list of lenses ranked by score (rank) with explanations.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/recommendations/[searchSessionId]">
) {
  const { searchSessionId } = await ctx.params;

  const validation = validateSearchSessionId(searchSessionId);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors }, { status: 400 });
  }

  try {
    const result = await getSearchSessionById(validation.data);

    if (!result) {
      return NextResponse.json(
        { error: `No search session found for id "${validation.data}"` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/recommendations/[searchSessionId] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
