import { astroType, ExperienceLevel, Mount } from "../../generated/prisma/enums";

// Input validation for the questionnaire API (Week 2 Friday per the sprint
// plan). Kept dependency-free (no zod/yup) and framework-agnostic so it can
// be unit tested without spinning up a request or touching the database.

export interface QuestionnaireInput {
  customerId: string;
  budget: number;
  mount?: Mount;
  astroType?: astroType;
  experienceLevel?: ExperienceLevel;
}

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: string[] };

const MOUNT_VALUES = Object.values(Mount) as string[];
const ASTRO_TYPE_VALUES = Object.values(astroType) as string[];
const EXPERIENCE_LEVEL_VALUES = Object.values(ExperienceLevel) as string[];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates the POST /api/questionnaire request body.
 * Collects every error found (rather than stopping at the first) so the
 * client gets the full picture in one round trip.
 */
export function validateQuestionnaireInput(
  body: unknown
): ValidationResult<QuestionnaireInput> {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, errors: ["Request body must be a JSON object"] };
  }

  const { customerId, budget, mount, astroType: astroTypeInput, experienceLevel } =
    body as Record<string, unknown>;

  if (!isNonEmptyString(customerId)) {
    errors.push("customerId is required and must be a non-empty string");
  }

  if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) {
    errors.push("budget is required and must be a positive number");
  }

  if (mount !== undefined && !MOUNT_VALUES.includes(mount as string)) {
    errors.push(`mount must be one of: ${MOUNT_VALUES.join(", ")}`);
  }

  if (
    astroTypeInput !== undefined &&
    !ASTRO_TYPE_VALUES.includes(astroTypeInput as string)
  ) {
    errors.push(`astroType must be one of: ${ASTRO_TYPE_VALUES.join(", ")}`);
  }

  if (
    experienceLevel !== undefined &&
    !EXPERIENCE_LEVEL_VALUES.includes(experienceLevel as string)
  ) {
    errors.push(
      `experienceLevel must be one of: ${EXPERIENCE_LEVEL_VALUES.join(", ")}`
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      customerId: (customerId as string).trim(),
      budget: budget as number,
      mount: mount as Mount | undefined,
      astroType: astroTypeInput as astroType | undefined,
      experienceLevel: experienceLevel as ExperienceLevel | undefined,
    },
  };
}

/** Validates the :searchSessionId route param on GET /api/recommendations/:id. */
export function validateSearchSessionId(
  searchSessionId: unknown
): ValidationResult<string> {
  if (!isNonEmptyString(searchSessionId)) {
    return {
      valid: false,
      errors: ["searchSessionId route param is required"],
    };
  }
  return { valid: true, data: searchSessionId.trim() };
}
