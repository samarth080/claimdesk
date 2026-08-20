import { describe, expect, it } from "vitest";

import type { ClaimContext, DiagnosisCode } from "@/lib/types/domain";

import { diagnoseClaim } from "../engine";
import { RULE_PRECEDENCE } from "../rules";
import { makeContext } from "./fixtures";

type DiagnosisFixture = {
  name: string;
  code: DiagnosisCode;
  context: () => ClaimContext;
};

const diagnosisFixtures: DiagnosisFixture[] = [
  {
    name: "an impatient claim inside the tracking SLA",
    code: "WITHIN_TRACKING_SLA",
    context: () =>
      makeContext({
        order: { orderedAt: "2026-08-20T10:00:00.000Z" },
        click: { clickedAt: "2026-08-20T09:30:00.000Z" },
      }),
  },
  {
    name: "a pending delivered order inside confirmation",
    code: "PENDING_CONFIRMATION_WINDOW",
    context: () =>
      makeContext({
        order: { orderedAt: "2026-08-10T12:00:00.000Z" },
        click: { clickedAt: "2026-08-10T11:30:00.000Z" },
        cashbackRecord: { status: "pending" },
      }),
  },
  {
    name: "a returned order",
    code: "ORDER_CANCELLED_OR_RETURNED",
    context: () => makeContext({ order: { status: "returned" } }),
  },
  {
    name: "an excluded gift-card order",
    code: "EXCLUDED_CATEGORY",
    context: () => makeContext({ order: { category: "Gift cards" } }),
  },
  {
    name: "an order with no pre-order click",
    code: "NO_CLICK_RECORDED",
    context: () => makeContext({ click: null }),
  },
  {
    name: "a stripped referrer",
    code: "REFERRER_STRIPPED",
    context: () => makeContext({ click: { referrerIntact: false } }),
  },
  {
    name: "a known native app handoff",
    code: "NATIVE_APP_HANDOFF",
    context: () =>
      makeContext({
        retailer: { knownDeeplinkIssue: true },
        click: { handoffToNativeApp: true },
      }),
  },
  {
    name: "an external coupon on a non-stacking retailer",
    code: "COUPON_ATTRIBUTION_LOSS",
    context: () =>
      makeContext({ order: { couponCodeUsed: "OTHERDEAL" } }),
  },
  {
    name: "an expired click session",
    code: "SESSION_EXPIRED",
    context: () =>
      makeContext({ click: { clickedAt: "2026-08-14T10:00:00.000Z" } }),
  },
  {
    name: "a preloaded cart",
    code: "CART_PRELOADED",
    context: () => makeContext({ click: { cartPreloaded: true } }),
  },
  {
    name: "an order email mismatch",
    code: "ACCOUNT_MISMATCH",
    context: () =>
      makeContext({ order: { emailUsed: "different@example.test" } }),
  },
  {
    name: "a clean genuine tracking failure",
    code: "GENUINE_TRACKING_FAILURE",
    context: () => makeContext(),
  },
  {
    name: "a claim with no matchable order",
    code: "INSUFFICIENT_EVIDENCE",
    context: () => makeContext({ order: null, click: null }),
  },
];

describe("diagnoseClaim", () => {
  it.each(diagnosisFixtures)("diagnoses $name", ({ code, context }) => {
    const result = diagnoseClaim(context());

    expect(result.code).toBe(code);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.explanation.length).toBeGreaterThan(30);
    expect(result.trace.find((entry) => entry.code === code)?.status).toBe(
      "fired",
    );
  });

  it("encodes the documented precedence as a readable ordered array", () => {
    expect(RULE_PRECEDENCE).toEqual([
      "ORDER_CANCELLED_OR_RETURNED",
      "EXCLUDED_CATEGORY",
      "WITHIN_TRACKING_SLA",
      "PENDING_CONFIRMATION_WINDOW",
      "NO_CLICK_RECORDED",
      "REFERRER_STRIPPED",
      "NATIVE_APP_HANDOFF",
      "COUPON_ATTRIBUTION_LOSS",
      "SESSION_EXPIRED",
      "CART_PRELOADED",
      "ACCOUNT_MISMATCH",
      "GENUINE_TRACKING_FAILURE",
      "INSUFFICIENT_EVIDENCE",
    ]);
  });

  it("returns cancellation instead of telling an in-SLA user to wait", () => {
    const result = diagnoseClaim(
      makeContext({
        order: {
          orderedAt: "2026-08-20T10:00:00.000Z",
          status: "cancelled",
        },
        click: { clickedAt: "2026-08-20T09:30:00.000Z" },
      }),
    );

    expect(result.code).toBe("ORDER_CANCELLED_OR_RETURNED");
    expect(
      result.trace.find((entry) => entry.code === "WITHIN_TRACKING_SLA")
        ?.status,
    ).toBe("not_evaluated");
  });

  it("returns excluded category before a broken referrer", () => {
    const result = diagnoseClaim(
      makeContext({
        order: { category: "Gift cards" },
        click: { referrerIntact: false },
      }),
    );

    expect(result.code).toBe("EXCLUDED_CATEGORY");
    expect(
      result.trace.find((entry) => entry.code === "REFERRER_STRIPPED")
        ?.status,
    ).toBe("not_evaluated");
  });

  it("distinguishes an old click from no click so session expiry is reachable", () => {
    const result = diagnoseClaim(
      makeContext({ click: { clickedAt: "2026-08-14T10:00:00.000Z" } }),
    );

    expect(result.code).toBe("SESSION_EXPIRED");
    expect(
      result.trace.find((entry) => entry.code === "NO_CLICK_RECORDED")
        ?.status,
    ).toBe("skipped");
  });

  it("drafts a complete network packet for a genuine failure", () => {
    const result = diagnoseClaim(makeContext());

    expect(result.disposition).toBe("escalate_network");
    expect(result.escalationPacket).toMatchObject({
      caseId: "NET-CLAIM-12",
      retailer: "Nimbus Mart",
      clickId: "clk_external_1",
      orderValue: 1_000,
      requestedAction:
        "Validate the transaction and create the missing cashback record.",
    });
    expect(result.escalationPacket?.evidenceSummary).toHaveLength(4);
  });

  it("routes an over-limit goodwill case to a human without changing its code", () => {
    const result = diagnoseClaim(
      makeContext({
        claim: { claimedOrderValue: 2_500 },
        order: { orderValue: 2_500 },
        click: { referrerIntact: false },
      }),
    );

    expect(result.code).toBe("REFERRER_STRIPPED");
    expect(result.baseDisposition).toBe("auto_resolve");
    expect(result.disposition).toBe("escalate_human");
    expect(result.goodwill?.approved).toBe(false);
  });
});
