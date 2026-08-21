import { describe, expect, it } from "vitest";

import { diagnoseClaim } from "@/lib/rules/engine";
import { makeContext } from "@/lib/rules/__tests__/fixtures";

import { buildReasoningView } from "./view";

function viewFor(...args: Parameters<typeof makeContext>) {
  return buildReasoningView(diagnoseClaim(makeContext(...args)));
}

describe("evidence stage", () => {
  it("groups readings by source in the order a reviewer reads them", () => {
    const view = viewFor();

    expect(view.evidence.map((group) => group.source)).toEqual([
      "user",
      "retailer",
      "order",
      "click",
      "cashback",
      "runtime",
    ]);
    expect(view.evidence[3]?.label).toBe("Click log");
  });

  it("counts what was found and what was missing in each group", () => {
    const view = viewFor({ click: null });
    const clickGroup = view.evidence.find((group) => group.source === "click");

    expect(clickGroup).toBeDefined();
    expect(clickGroup!.missing).toBeGreaterThan(0);
    expect(clickGroup!.found + clickGroup!.missing).toBe(
      clickGroup!.readings.length + clickGroup!.withheld,
    );
  });

  it("renders an absent click record as a stated finding, not a blank", () => {
    const view = viewFor({ click: null });
    const clickGroup = view.evidence.find((group) => group.source === "click");
    const record = clickGroup?.readings.find(
      (entry) => entry.field === "click_record",
    );

    expect(record?.found).toBe(false);
    expect(record?.value).toBe(
      "None found for this retailer before the order",
    );
  });

  it("withholds fields that cannot be read because their record is absent", () => {
    const view = viewFor({ click: null });
    const clickGroup = view.evidence.find((group) => group.source === "click");

    expect(clickGroup?.readings.map((entry) => entry.field)).toEqual([
      "click_record",
      "pre_order_click_count",
    ]);
    expect(clickGroup?.withheld).toBe(5);
    expect(clickGroup?.withheldNote).toContain("5");
    expect(clickGroup?.missing).toBe(6);
  });

  it("keeps every claim-input field, which has no record to depend on", () => {
    const view = viewFor({ order: null, click: null });
    const runtime = view.evidence.find((group) => group.source === "runtime");

    expect(runtime?.withheld).toBe(0);
    expect(runtime?.readings).toHaveLength(7);
    expect(
      runtime?.readings.find((entry) => entry.field === "hours_since_click"),
    ).toMatchObject({ found: false, value: "Not recorded" });
  });

  it("formats money, timestamps, booleans and durations for reading", () => {
    const view = viewFor();
    const readings = view.evidence.flatMap((group) => group.readings);
    const display = (field: string) =>
      readings.find((entry) => entry.field === field)?.value;

    expect(display("order_value")).toBe("₹1,000");
    expect(display("referrer_intact")).toBe("Yes");
    expect(display("allows_coupon_stacking")).toBe("No");
    expect(display("ordered_at")).toContain("August");
    expect(display("tracking_sla_hours")).toBe("24 h");
    expect(display("hours_click_to_order")).toBe("0.5 h");
  });

  it("gives every reading a human label beside its field name", () => {
    const view = viewFor();
    const readings = view.evidence.flatMap((group) => group.readings);

    expect(readings.every((entry) => entry.label.length > 0)).toBe(true);
    expect(
      readings.find((entry) => entry.field === "email_used")?.label,
    ).toBe("Email on the order");
  });
});

describe("rules stage", () => {
  it("lists all thirteen rules with position, outcome and reason", () => {
    const view = viewFor();

    expect(view.rules).toHaveLength(13);
    expect(view.rules[0]).toMatchObject({
      order: 1,
      code: "ORDER_CANCELLED_OR_RETURNED",
      outcome: "not_matched",
    });
    expect(view.rules.every((rule) => rule.reason.length > 0)).toBe(true);
    expect(view.rules.every((rule) => rule.test.length > 0)).toBe(true);
  });

  it("reports where evaluation stopped and what was never reached", () => {
    const view = viewFor({
      order: { orderedAt: "2026-08-20T10:00:00.000Z", status: "cancelled" },
      click: { clickedAt: "2026-08-20T09:30:00.000Z" },
    });

    expect(view.summary.matchedAt).toBe(1);
    expect(view.summary.rulesEvaluated).toBe(1);
    expect(view.summary.rulesNotReached).toBe(12);
    expect(
      view.rules.filter((rule) => rule.outcome === "not_reached"),
    ).toHaveLength(12);
  });
});

describe("diagnosis stage", () => {
  it("names the code in plain language beside the cause", () => {
    const view = viewFor({ order: { status: "returned" } });

    expect(view.diagnosis).toMatchObject({
      code: "ORDER_CANCELLED_OR_RETURNED",
      label: "Cancelled or returned",
      confidence: 0.99,
    });
    expect(view.diagnosis.cause).toContain("returned");
  });
});

describe("action stage", () => {
  it("describes an auto-approved goodwill credit with its policy checks", () => {
    const view = viewFor({
      claim: { claimedOrderValue: 1_500 },
      order: { orderValue: 1_500 },
      click: { referrerIntact: false },
    });

    expect(view.action).toMatchObject({
      kind: "goodwill_credit",
      label: "Goodwill credit issued",
      tone: "resolved",
    });
    expect(view.action.policyChecks).toHaveLength(3);
  });

  it("attaches the generated packet to a network escalation", () => {
    const view = viewFor();

    expect(view.action.kind).toBe("escalated_network");
    expect(view.action.tone).toBe("escalated");
    expect(view.action.packet).toMatchObject({ caseId: "NET-CLAIM-12" });
    expect(view.action.packet?.fields.length).toBeGreaterThan(0);
  });

  it("carries no packet for a plain resolution message", () => {
    const view = viewFor({ order: { status: "returned" } });

    expect(view.action.kind).toBe("message_sent");
    expect(view.action.packet).toBeNull();
    expect(view.action.policyChecks).toHaveLength(0);
  });
});
