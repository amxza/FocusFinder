import { NextResponse } from "next/server";
import { generateRecommendations } from "../../../lib/services/recommendationEngine";
import { validateQuestionnaireInput } from "../../../lib/utils/validation";
import { Prisma } from "../../../generated/prisma/client";

// POST /api/questionnaire
// Input:  { customerId, mount, astroType, budget, experienceLevel }
// Output: { searchSessionId, recommendations: [...] }
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const validation = validateQuestionnaireInput(body);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors }, { status: 400 });
  }

  try {
    const searchSession = await generateRecommendations(validation.data);

    return NextResponse.json(
      {
        searchSessionId: searchSession.id,
        recommendations: searchSession.recommendations,
      },
      { status: 201 }
    );
  } catch (error) {
    // Foreign key violation -> the given customerId doesn't exist.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "customerId does not match an existing customer" },
        { status: 404 }
      );
    }

    console.error("POST /api/questionnaire failed:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
