import { describe, expect, it } from "vitest";

import {
  calculateAvoidedImpact,
  summarizeImpact,
  type ImpactClaimRow,
} from "./metrics";

const rows: ImpactClaimRow[] = [
  { status: "resolved", diagnosis_code: "WITHIN_TRACKING_SLA" },
  { status: "resolved", diagnosis_code: "WITHIN_TRACKING_SLA" },
  { status: "resolved", diagnosis_code: "NO_CLICK_RECORDED" },
  { status: "needs_input", diagnosis_code: "ACCOUNT_MISMATCH" },
  { status: "escalated", diagnosis_code: "GENUINE_TRACKING_FAILURE" },
  { status: "escalated", diagnosis_code: "GENUINE_TRACKING_FAILURE" },
  { status: "submitted", diagnosis_code: null },
];

describe("impact metrics", () => {
  it("keeps resolved, clarification and escalation outcomes separate", () => {
    const summary = summarizeImpact(rows);

    expect(summary).toMatchObject({
      total: 7,
      diagnosed: 6,
      resolved: 3,
      needsInput: 1,
      escalated: 2,
      other: 1,
      resolvedRate: 3 / 7,
      needsInputRate: 1 / 7,
      escalatedRate: 2 / 7,
    });
  });

  it("sorts diagnosis rows by volume and carries status segments", () => {
    const summary = summarizeImpact(rows);

    expect(summary.breakdown.map((row) => row.code)).toEqual([
      "WITHIN_TRACKING_SLA",
      "GENUINE_TRACKING_FAILURE",
      "NO_CLICK_RECORDED",
      "ACCOUNT_MISMATCH",
    ]);
    expect(summary.breakdown[0]).toMatchObject({
      total: 2,
      resolved: 2,
      needsInput: 0,
      escalated: 0,
      share: 2 / 7,
    });
  });

  it("calculates savings only from resolved claims", () => {
    expect(calculateAvoidedImpact(35, 45, 11)).toEqual({
      humanTouchesAvoided: 35,
      estimatedCostAvoided: 1_575,
      agentMinutesAvoided: 385,
    });
  });

  it("clamps disputed assumptions at zero", () => {
    expect(calculateAvoidedImpact(3, -45, -11)).toEqual({
      humanTouchesAvoided: 3,
      estimatedCostAvoided: 0,
      agentMinutesAvoided: 0,
    });
  });
});
