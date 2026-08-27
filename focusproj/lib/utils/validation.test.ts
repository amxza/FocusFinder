import { describe, expect, it } from "vitest";
import {
  validateQuestionnaireInput,
  validateSearchSessionId,
} from "./validation";

describe("validateQuestionnaireInput", () => {
  it("accepts a fully populated valid payload", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      mount: "NIKONF",
      astroType: "DEEPSKY",
      budget: 600,
      experienceLevel: "BEGINNER",
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual({
        customerId: "cust_123",
        mount: "NIKONF",
        astroType: "DEEPSKY",
        budget: 600,
        experienceLevel: "BEGINNER",
      });
    }
  });

  it("accepts the minimal required payload (only customerId + budget)", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: 300,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.mount).toBeUndefined();
      expect(result.data.astroType).toBeUndefined();
      expect(result.data.experienceLevel).toBeUndefined();
    }
  });

  it("trims whitespace from customerId", () => {
    const result = validateQuestionnaireInput({
      customerId: "  cust_123  ",
      budget: 300,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.customerId).toBe("cust_123");
    }
  });

  it("rejects a non-object body", () => {
    const result = validateQuestionnaireInput("not an object");
    expect(result.valid).toBe(false);
  });

  it("rejects null", () => {
    const result = validateQuestionnaireInput(null);
    expect(result.valid).toBe(false);
  });

  it("rejects an array body", () => {
    const result = validateQuestionnaireInput([]);
    expect(result.valid).toBe(false);
  });

  it("rejects a missing customerId", () => {
    const result = validateQuestionnaireInput({ budget: 300 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain(
        "customerId is required and must be a non-empty string"
      );
    }
  });

  it("rejects an empty-string customerId", () => {
    const result = validateQuestionnaireInput({ customerId: "   ", budget: 300 });
    expect(result.valid).toBe(false);
  });

  it("rejects a missing budget", () => {
    const result = validateQuestionnaireInput({ customerId: "cust_123" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain(
        "budget is required and must be a positive number"
      );
    }
  });

  it("rejects a zero budget", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a negative budget", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: -50,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-numeric budget (string)", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: "600",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-finite budget", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: Infinity,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid mount value", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: 300,
      mount: "PENTAX_K",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.startsWith("mount must be one of"))).toBe(
        true
      );
    }
  });

  it("rejects an invalid astroType value", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: 300,
      astroType: "SUNSET",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an invalid experienceLevel value", () => {
    const result = validateQuestionnaireInput({
      customerId: "cust_123",
      budget: 300,
      experienceLevel: "EXPERT",
    });
    expect(result.valid).toBe(false);
  });

  it("collects multiple errors at once instead of stopping at the first", () => {
    const result = validateQuestionnaireInput({
      mount: "BAD",
      astroType: "BAD",
      experienceLevel: "BAD",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("validateSearchSessionId", () => {
  it("accepts a non-empty id string", () => {
    const result = validateSearchSessionId("cksession123");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBe("cksession123");
    }
  });

  it("trims whitespace", () => {
    const result = validateSearchSessionId("  cksession123  ");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBe("cksession123");
    }
  });

  it("rejects an empty string", () => {
    const result = validateSearchSessionId("");
    expect(result.valid).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    const result = validateSearchSessionId("   ");
    expect(result.valid).toBe(false);
  });

  it("rejects undefined", () => {
    const result = validateSearchSessionId(undefined);
    expect(result.valid).toBe(false);
  });

  it("rejects a non-string value", () => {
    const result = validateSearchSessionId(12345);
    expect(result.valid).toBe(false);
  });
});
