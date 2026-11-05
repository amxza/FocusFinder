import Anthropic from "@anthropic-ai/sdk";
import { claude, CLAUDE_MODEL } from "../claude/client";
import { ASTRO_TYPE_LABELS, getBudgetTierLabel, lensMatchesAstroType } from "../utils/constants";
import type { astroType, ExperienceLevel } from "../../generated/prisma/enums";

// Claude-generated recommendation explanations (Week 3, Mon-Tue per the
// sprint plan). Prompt: "Explain why [lens] is good for [astro type] with
// [budget]" -> a short, conversational aiExplain field.

// Only the lens fields the prompt actually needs -- callers can pass the
// full Prisma Lens (with relations) since this is structurally compatible.
export interface ExplanationLens {
  id: string;
  name: string;
  brand: string;
  price: number;
  idealUseCase: string[];
}

export interface ExplanationInput {
  lens: ExplanationLens;
  budget: number;
  astroType?: astroType | null;
  experienceLevel?: ExperienceLevel | null;
}

// Opus 5 keeps adaptive thinking on even at low effort, and thinking tokens
// share this same budget with the visible text -- 150 measured as too tight
// in practice (thinking alone ate ~45 tokens, truncating the answer
// mid-sentence with stop_reason "max_tokens"). 400 leaves comfortable room
// for both while the response is still just 1-2 sentences.
const MAX_EXPLANATION_TOKENS = 400;
const CLAUDE_REQUEST_TIMEOUT_MS = 10_000;

const EXPLANATION_SYSTEM_PROMPT =
  "You are an astrophotography gear advisor. Reply with exactly 1-2 short, " +
  "conversational sentences explaining how the lens fits what the user wants. " +
  "If you're told it isn't a dedicated lens for their goal, say so plainly and " +
  "don't oversell it. Speak directly to the user (\"you\"). No markdown, no " +
  "spec-sheet dumps, no preamble.";

// Common prompts repeat a lot -- a small lens catalog x a handful of astro
// types/budget tiers/experience levels is a bounded combination space, so an
// in-memory cache keyed on the bucketed inputs avoids re-paying for a Claude
// call every time the same combination comes up. This is process-local
// (resets on redeploy/cold start) -- fine for now, swap for a shared cache
// (Redis, a DB table) if this needs to survive across instances.
const explanationCache = new Map<string, string>();

function astroLabel(type: astroType | null | undefined): string {
  return type ? ASTRO_TYPE_LABELS[type] : "general astrophotography";
}

function experienceLabel(level: ExperienceLevel | null | undefined): string {
  if (level === "BEGINNER") return "a beginner";
  if (level === "INTERMEDIATE") return "an intermediate shooter";
  return "a shooter of unspecified experience level";
}

/** Bucketed cache key -- budget is rounded to its tier so nearby dollar amounts share a cache entry. */
export function buildExplanationCacheKey(input: ExplanationInput): string {
  return [
    input.lens.id,
    astroLabel(input.astroType),
    getBudgetTierLabel(input.budget),
    input.experienceLevel ?? "unspecified experience",
  ].join("::");
}

export function buildExplanationPrompt(input: ExplanationInput): string {
  if (lensMatchesAstroType(input.lens.idealUseCase, input.astroType) === false) {
    return (
      `The ${input.lens.brand} ${input.lens.name} (around $${input.lens.price}) is not a ` +
      `dedicated ${astroLabel(input.astroType)} lens, but it ranked among the best options for ` +
      `${experienceLabel(input.experienceLevel)} on a ${getBudgetTierLabel(input.budget)} budget. ` +
      `Explain honestly what it can and can't do for ${astroLabel(input.astroType)}.`
    );
  }

  return (
    `Explain why the ${input.lens.brand} ${input.lens.name} ` +
    `(around $${input.lens.price}) is a good choice for ${experienceLabel(input.experienceLevel)} ` +
    `doing ${astroLabel(input.astroType)} on a ${getBudgetTierLabel(input.budget)} budget.`
  );
}

function fallbackExplanation(input: ExplanationInput): string {
  if (lensMatchesAstroType(input.lens.idealUseCase, input.astroType) === false) {
    return (
      `The ${input.lens.brand} ${input.lens.name} fits your ${getBudgetTierLabel(input.budget)} ` +
      `budget, but it isn't a dedicated ${astroLabel(input.astroType)} lens, so expect some compromises.`
    );
  }

  return (
    `The ${input.lens.brand} ${input.lens.name} fits your ${getBudgetTierLabel(input.budget)} ` +
    `budget and suits ${astroLabel(input.astroType)}.`
  );
}

/**
 * Generates (or returns a cached) 1-2 sentence explanation for why a lens
 * was recommended. Never throws -- a Claude timeout/rate limit/API error
 * falls back to a deterministic, non-AI explanation so a single bad call
 * doesn't fail the whole recommendation response.
 */
export async function generateExplanation(
  input: ExplanationInput
): Promise<string> {
  const cacheKey = buildExplanationCacheKey(input);
  const cached = explanationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await claude.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: MAX_EXPLANATION_TOKENS,
        output_config: { effort: "low" }, // short, low-stakes text -- no need for deep thinking
        system: EXPLANATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildExplanationPrompt(input) }],
      },
      { timeout: CLAUDE_REQUEST_TIMEOUT_MS }
    );

    const text = response.content.find((b) => b.type === "text")?.text?.trim();
    const explanation = text && text.length > 0 ? text : fallbackExplanation(input);

    explanationCache.set(cacheKey, explanation);
    return explanation;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.warn("Claude rate-limited an explanation request:", error.message);
    } else if (error instanceof Anthropic.APIConnectionTimeoutError) {
      console.warn("Claude explanation request timed out:", error.message);
    } else if (error instanceof Anthropic.APIError) {
      console.warn(
        `Claude explanation request failed (${error.status}):`,
        error.message
      );
    } else {
      console.warn("Unexpected error generating Claude explanation:", error);
    }
    return fallbackExplanation(input);
  }
}

/** Test/ops hook -- clears the in-memory explanation cache. */
export function clearExplanationCache(): void {
  explanationCache.clear();
}
