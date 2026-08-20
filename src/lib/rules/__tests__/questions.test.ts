import { describe, expect, it } from "vitest";

import {
  pickClarifyingQuestion,
  rankClarifyingQuestions,
} from "../questions";

describe("information-gain question picker", () => {
  it("asks for the order email in a known account ambiguity", () => {
    const question = pickClarifyingQuestion({
      liveCodes: ["ACCOUNT_MISMATCH", "GENUINE_TRACKING_FAILURE"],
      unknowns: ["order_email", "coupon_source"],
    });

    expect(question?.id).toBe("WHICH_EMAIL");
    expect(question?.informationGain).toBe(1);
    expect(question?.outcomes).toEqual([
      {
        answer: "A different email",
        remainingCodes: ["ACCOUNT_MISMATCH"],
      },
      {
        answer: "My cashback account email",
        remainingCodes: ["GENUINE_TRACKING_FAILURE"],
      },
    ]);
  });

  it("uses the documented order-date exception for the vague demo", () => {
    const question = pickClarifyingQuestion({
      liveCodes: ["INSUFFICIENT_EVIDENCE", "GENUINE_TRACKING_FAILURE"],
      unknowns: ["order_date"],
    });

    expect(question?.id).toBe("ORDER_DATE");
    expect(question?.text).toBe("When did you place the order?");
  });

  it("ranks only questions that split live diagnoses and target unknowns", () => {
    const ranked = rankClarifyingQuestions({
      liveCodes: [
        "COUPON_ATTRIBUTION_LOSS",
        "SESSION_EXPIRED",
        "GENUINE_TRACKING_FAILURE",
      ],
      unknowns: ["coupon_source", "same_sitting", "cart_preloaded"],
    });

    expect(ranked.map((question) => question.id)).toEqual([
      "COUPON_SOURCE",
      "SAME_SITTING",
    ]);
  });

  it("returns no question when only one diagnosis remains live", () => {
    expect(
      pickClarifyingQuestion({
        liveCodes: ["ACCOUNT_MISMATCH"],
        unknowns: ["order_email"],
      }),
    ).toBeNull();
  });
});
