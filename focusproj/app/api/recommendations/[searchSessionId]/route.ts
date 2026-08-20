import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// GET /api/recommendations/:searchSessionId
// Returns: list of lenses ranked by score with explanations.
//
// Full implementation is a Week 2 Friday task; this is the route skeleton.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/recommendations/[searchSessionId]">
) {
  const { searchSessionId } = await ctx.params;

  const searchSession = await prisma.searchSession.findUnique({
    where: { id: searchSessionId },
    include: {
      recommendations: {
        orderBy: { rank: "asc" },
        include: { lensRecommendations: { include: { lens: true } } },
      },
    },
  });

  if (!searchSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(searchSession);
}
