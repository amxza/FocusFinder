import { NextResponse } from "next/server";
import { generateRecommendations } from "../../../lib/services/recommendationEngine";
import type { astroType, ExperienceLevel, Mount } from "../../../generated/prisma/enums";

// POST /api/questionnaire
// Input:  { customerId, mount, astroType, budget, experienceLevel }
// Output: { searchSessionId, recommendations: [...] }
//
// Full implementation (validation, error handling) is a Week 2 Friday task.
// This is the route skeleton so the folder structure exists.
export async function POST(request: Request) {
  const body = await request.json();

  const { customerId, mount, astroType, budget, experienceLevel } = body as {
    customerId: string;
    mount?: Mount;
    astroType?: astroType;
    budget: number;
    experienceLevel?: ExperienceLevel;
  };

  // TODO (Week 2 Friday): validate input, return 400 on bad payloads
  if (!customerId || !budget) {
    return NextResponse.json(
      { error: "customerId and budget are required" },
      { status: 400 }
    );
  }

  const searchSession = await generateRecommendations({
    customerId,
    mount,
    astroType,
    budget,
    experienceLevel,
  });

  return NextResponse.json({
    searchSessionId: searchSession.id,
    recommendations: searchSession.recommendations,
  });
}
