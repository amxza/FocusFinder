import { NextResponse } from "next/server";
import { testClaudeConnection } from "../../../../lib/claude/client";

// GET /api/claude/test
// Dev-only sanity check for the Claude API connection.
// Hit this once ANTHROPIC_API_KEY is set in .env to confirm the setup works.
export async function GET() {
  const result = await testClaudeConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
