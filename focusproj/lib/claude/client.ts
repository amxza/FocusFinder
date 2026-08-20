import Anthropic from "@anthropic-ai/sdk";

// Basic Claude API client setup (Week 2 Mon-Tue).
// Real explanation-generation prompts land in Week 3.
//
// Reads ANTHROPIC_API_KEY from the environment - add it to .env:
//   ANTHROPIC_API_KEY="sk-ant-..."
export const claude = new Anthropic();

export const CLAUDE_MODEL = "claude-opus-5";

/**
 * Sanity-checks that the API key/connection works. Not used in production
 * routes - call from a script or a temporary route while setting up.
 */
export async function testClaudeConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with just the word: pong" }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return { ok: true, message: text.trim() };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, message: "Authentication failed - check ANTHROPIC_API_KEY" };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, message: `API error ${error.status}: ${error.message}` };
    }
    return { ok: false, message: `Unexpected error: ${String(error)}` };
  }
}
