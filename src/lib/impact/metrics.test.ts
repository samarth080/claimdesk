import { describe, expect, it } from "vitest";

import {
  buildProjectionChain,
  DEFAULT_IMPACT_ASSUMPTIONS,
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
});

describe("projection chain", () => {
  const summary = summarizeImpact(rows);

  it("shows the arithmetic as four ordered steps", () => {
    const chain = buildProjectionChain(summary, DEFAULT_IMPACT_ASSUMPTIONS);

    expect(chain.steps.map((step) => step.id)).toEqual([
      "total",
      "auto_resolved",
      "minutes",
      "cost",
    ]);
    expect(chain.steps.map((step) => step.unit)).toEqual([
      "claims",
      "claims",
      "minutes",
      "rupees",
    ]);
  });

  it("counts only resolved claims into the projection", () => {
    const chain = buildProjectionChain(summary, DEFAULT_IMPACT_ASSUMPTIONS);

    expect(chain.steps[0]?.value).toBe(7);
    expect(chain.steps[1]?.value).toBe(3);
    expect(chain.humanTouchesAvoided).toBe(3);
  });

  it("multiplies through handle time and then cost per minute", () => {
    const chain = buildProjectionChain(summary, {
      handleTimeMinutes: 11,
      costPerMinute: 4,
    });

    expect(chain.steps[2]?.value).toBe(33);
    expect(chain.steps[3]?.value).toBe(132);
    expect(chain.agentMinutesAvoided).toBe(33);
    expect(chain.projectedCostAvoided).toBe(132);
  });

  it("recomputes when an assumption is changed", () => {
    const chain = buildProjectionChain(summary, {
      handleTimeMinutes: 20,
      costPerMinute: 5,
    });

    expect(chain.agentMinutesAvoided).toBe(60);
    expect(chain.projectedCostAvoided).toBe(300);
  });

  it("clamps disputed assumptions at zero", () => {
    const chain = buildProjectionChain(summary, {
      handleTimeMinutes: -11,
      costPerMinute: -4,
    });

    expect(chain.agentMinutesAvoided).toBe(0);
    expect(chain.projectedCostAvoided).toBe(0);
    expect(chain.humanTouchesAvoided).toBe(3);
  });

  it("points each claim-count step at the bucket it filters to", () => {
    const chain = buildProjectionChain(summary, DEFAULT_IMPACT_ASSUMPTIONS);

    expect(chain.steps[0]?.bucket).toBe("all");
    expect(chain.steps[1]?.bucket).toBe("resolved");
    expect(chain.steps[2]?.bucket).toBeNull();
  });

  it("states where every default assumption came from", () => {
    const chain = buildProjectionChain(summary, DEFAULT_IMPACT_ASSUMPTIONS);

    expect(chain.steps.every((step) => step.note.length > 0)).toBe(true);
    expect(chain.steps[2]?.operator).toContain("11");
  });
});
