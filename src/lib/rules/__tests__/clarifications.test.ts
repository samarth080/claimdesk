import { describe, expect, it } from "vitest";

import {
  applyClarifyingAnswer,
  diagnoseClaim,
  isValidClarifyingAnswer,
  routeAfterClarification,
  selectClarifyingQuestionForDiagnosis,
} from "..";

import { makeContext } from "./fixtures";

describe("clarifying-answer loop", () => {
  it("turns the highest-gain rule question into an input contract", () => {
    expect(
      selectClarifyingQuestionForDiagnosis("INSUFFICIENT_EVIDENCE"),
    ).toMatchObject({
      id: "ORDER_DATE",
      inputType: "date",
      candidateCountBefore: 2,
      expectedRemainingCodes: 1,
    });
  });

  it("validates the input required by each targeted question", () => {
    expect(isValidClarifyingAnswer("WHICH_EMAIL", "order@example.test")).toBe(
      true,
    );
    expect(isValidClarifyingAnswer("WHICH_EMAIL", "not-an-email")).toBe(false);
    expect(isValidClarifyingAnswer("ORDER_DATE", "2026-08-15")).toBe(true);
    expect(isValidClarifyingAnswer("ORDER_DATE", "last Tuesday")).toBe(false);
  });

  it("merges an order date into the claim before re-running the rules", () => {
    const initial = makeContext({
      claim: { claimedOrderDate: null, claimedOrderValue: null },
    });
    expect(diagnoseClaim(initial).code).toBe("INSUFFICIENT_EVIDENCE");

    const answered = applyClarifyingAnswer(
      initial,
      "ORDER_DATE",
      "2026-08-15",
    );

    expect(answered.claim.clarifyingAnswer).toBe("2026-08-15");
    expect(diagnoseClaim(answered).code).toBe("GENUINE_TRACKING_FAILURE");
  });

  it("routes a confirmed account mismatch to a human after one answer", () => {
    const context = makeContext({
      order: { emailUsed: "order@example.test", orderValue: 1_890 },
    });
    const initial = diagnoseClaim(context);

    const result = routeAfterClarification(
      context,
      initial,
      "WHICH_EMAIL",
      "order@example.test",
    );

    expect(initial.code).toBe("ACCOUNT_MISMATCH");
    expect(initial.disposition).toBe("needs_input");
    expect(result.code).toBe("ACCOUNT_MISMATCH");
    expect(result.disposition).toBe("escalate_human");
    expect(result.explanation).toContain("₹1,890");
  });

  it("escalates an unresolved date gap instead of repeating the question", () => {
    const context = makeContext({ order: null, click: null });
    const initial = diagnoseClaim(context);

    const result = routeAfterClarification(
      context,
      initial,
      "ORDER_DATE",
      "2026-08-15",
    );

    expect(result.code).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.disposition).toBe("escalate_human");
    expect(result.explanation).toContain("36-hour");
  });
});
