import { describe, expect, it } from "vitest";

import type { EvidenceReading } from "../engine";
import { diagnoseClaim } from "../engine";
import { RULE_PRECEDENCE } from "../rules";
import { makeContext } from "./fixtures";

function reading(
  readings: EvidenceReading[],
  source: EvidenceReading["source"],
  field: string,
): EvidenceReading | undefined {
  return readings.find(
    (entry) => entry.source === source && entry.field === field,
  );
}

describe("diagnoseClaim trace", () => {
  it("gives every rule in the precedence array a positioned entry", () => {
    const result = diagnoseClaim(makeContext());

    expect(result.trace).toHaveLength(RULE_PRECEDENCE.length);
    expect(result.trace.map((entry) => entry.code)).toEqual([
      ...RULE_PRECEDENCE,
    ]);
    expect(result.trace.map((entry) => entry.order)).toEqual(
      RULE_PRECEDENCE.map((_, index) => index + 1),
    );
  });

  it("marks a cancelled order matched and the SLA rule never reached", () => {
    const result = diagnoseClaim(
      makeContext({
        order: { orderedAt: "2026-08-20T10:00:00.000Z", status: "cancelled" },
        click: { clickedAt: "2026-08-20T09:30:00.000Z" },
      }),
    );

    const cancelled = result.trace.find(
      (entry) => entry.code === "ORDER_CANCELLED_OR_RETURNED",
    );
    const withinSla = result.trace.find(
      (entry) => entry.code === "WITHIN_TRACKING_SLA",
    );

    expect(cancelled?.outcome).toBe("matched");
    expect(cancelled?.order).toBe(1);
    expect(cancelled?.reason).toContain("cancelled");
    expect(withinSla?.outcome).toBe("not_reached");
    expect(withinSla?.reason).toContain("ORDER_CANCELLED_OR_RETURNED");
  });

  it("explains a not_matched rule with the evidence value it read", () => {
    const result = diagnoseClaim(
      makeContext({ order: { category: "Gift cards" } }),
    );

    const cancelled = result.trace.find(
      (entry) => entry.code === "ORDER_CANCELLED_OR_RETURNED",
    );

    expect(result.code).toBe("EXCLUDED_CATEGORY");
    expect(cancelled?.outcome).toBe("not_matched");
    expect(cancelled?.reason).toContain("delivered");
  });

  it("keeps exactly one matched rule", () => {
    const result = diagnoseClaim(makeContext());
    const matched = result.trace.filter(
      (entry) => entry.outcome === "matched",
    );

    expect(matched).toHaveLength(1);
    expect(matched[0]?.code).toBe(result.code);
  });
});

describe("diagnoseClaim evidenceRead", () => {
  it("reports the matched order fields it read", () => {
    const result = diagnoseClaim(makeContext());

    expect(reading(result.evidenceRead, "order", "status")).toMatchObject({
      value: "delivered",
      found: true,
    });
    expect(reading(result.evidenceRead, "order", "order_value")).toMatchObject({
      value: 1_000,
      found: true,
    });
  });

  it("records a missing click row as evidence rather than omitting it", () => {
    const result = diagnoseClaim(makeContext({ click: null }));

    expect(result.code).toBe("NO_CLICK_RECORDED");
    expect(reading(result.evidenceRead, "click", "click_record")).toMatchObject({
      value: null,
      found: false,
    });
    expect(
      reading(result.evidenceRead, "click", "pre_order_click_count"),
    ).toMatchObject({ value: 0, found: true });
  });

  it("records a missing cashback row as evidence", () => {
    const result = diagnoseClaim(makeContext());

    expect(
      reading(result.evidenceRead, "cashback", "cashback_record"),
    ).toMatchObject({ value: null, found: false });
  });

  it("records a missing order row when nothing could be matched", () => {
    const result = diagnoseClaim(makeContext({ order: null, click: null }));

    expect(result.code).toBe("INSUFFICIENT_EVIDENCE");
    expect(reading(result.evidenceRead, "order", "order_record")).toMatchObject({
      value: null,
      found: false,
    });
  });

  it("reads the retailer policy values the rules depend on", () => {
    const result = diagnoseClaim(makeContext());

    expect(
      reading(result.evidenceRead, "retailer", "tracking_sla_hours"),
    ).toMatchObject({ value: 24, found: true });
    expect(
      reading(result.evidenceRead, "retailer", "allows_coupon_stacking"),
    ).toMatchObject({ value: false, found: true });
  });

  it("reads the account email that ACCOUNT_MISMATCH compares against", () => {
    const result = diagnoseClaim(makeContext());

    expect(
      reading(result.evidenceRead, "user", "account_email"),
    ).toMatchObject({ value: "person@example.test", found: true });
  });

  it("exposes the elapsed-time values the timing rules compute", () => {
    const result = diagnoseClaim(makeContext());

    expect(
      reading(result.evidenceRead, "runtime", "hours_since_click"),
    ).toMatchObject({ found: true });
    expect(
      reading(result.evidenceRead, "runtime", "hours_click_to_order"),
    ).toMatchObject({ value: 0.5, found: true });
  });
});

describe("diagnoseClaim action", () => {
  it("reports a network escalation with its case reference", () => {
    const result = diagnoseClaim(makeContext());

    expect(result.action.kind).toBe("escalated_network");
    expect(result.action.detail).toContain("NET-CLAIM-12");
  });

  it("reports an auto-approved goodwill credit with its policy checks", () => {
    const result = diagnoseClaim(
      makeContext({
        claim: { claimedOrderValue: 1_500 },
        order: { orderValue: 1_500 },
        click: { referrerIntact: false },
      }),
    );

    expect(result.action.kind).toBe("goodwill_credit");
    expect(result.action.policyChecks).toHaveLength(3);
    expect(
      result.action.policyChecks?.every((check) => check.passed),
    ).toBe(true);
  });

  it("reports a human escalation when a goodwill check fails", () => {
    const result = diagnoseClaim(
      makeContext({
        claim: { claimedOrderValue: 2_500 },
        order: { orderValue: 2_500 },
        click: { referrerIntact: false },
      }),
    );

    expect(result.action.kind).toBe("escalated_human");
    expect(
      result.action.policyChecks?.filter((check) => !check.passed),
    ).toHaveLength(1);
  });

  it("reports a question for a claim that needs one more detail", () => {
    const result = diagnoseClaim(makeContext({ order: null, click: null }));

    expect(result.action.kind).toBe("question_asked");
  });

  it("reports a sent message for a plain auto-resolution", () => {
    const result = diagnoseClaim(makeContext({ order: { status: "returned" } }));

    expect(result.action.kind).toBe("message_sent");
    expect(result.action.policyChecks).toBeUndefined();
  });
});
