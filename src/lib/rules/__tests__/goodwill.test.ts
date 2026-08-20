import { describe, expect, it } from "vitest";

import { evaluateGoodwillPolicy } from "../goodwill";

describe("goodwill credit policy", () => {
  it("auto-approves the exact value and frequency boundaries", () => {
    const result = evaluateGoodwillPolicy({
      diagnosisCode: "NATIVE_APP_HANDOFF",
      claimedOrderValue: 2_000,
      creditsInLast90Days: 2,
    });

    expect(result.approved).toBe(true);
    expect(result.routeToHuman).toBe(false);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("routes a claim above ₹2,000 to a human with a failed value check", () => {
    const result = evaluateGoodwillPolicy({
      diagnosisCode: "REFERRER_STRIPPED",
      claimedOrderValue: 2_000.01,
      creditsInLast90Days: 0,
    });

    expect(result.approved).toBe(false);
    expect(result.routeToHuman).toBe(true);
    expect(result.checks.find((check) => check.id === "claim_value")?.passed).toBe(
      false,
    );
  });

  it("routes a fourth-in-window request to a human", () => {
    const result = evaluateGoodwillPolicy({
      diagnosisCode: "NATIVE_APP_HANDOFF",
      claimedOrderValue: 1_200,
      creditsInLast90Days: 3,
    });

    expect(result.approved).toBe(false);
    expect(
      result.checks.find((check) => check.id === "recent_credit_count")
        ?.passed,
    ).toBe(false);
  });

  it("marks non-platform diagnoses as not applicable", () => {
    const result = evaluateGoodwillPolicy({
      diagnosisCode: "EXCLUDED_CATEGORY",
      claimedOrderValue: 1_000,
      creditsInLast90Days: 0,
    });

    expect(result.applicable).toBe(false);
    expect(result.routeToHuman).toBe(false);
  });
});
