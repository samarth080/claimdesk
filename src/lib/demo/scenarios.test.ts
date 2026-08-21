import { describe, expect, it } from "vitest";

import type { Order } from "@/lib/types/domain";

import {
  DEMO_SCENARIOS,
  demoOrderDate,
  demoSuggestedAnswer,
  getDemoScenario,
  resolveDemoClaimDate,
} from "./scenarios";

function seededOrder(overrides: Partial<Order>): Order {
  return {
    id: "order-seed",
    userId: "user-1",
    retailerId: "retailer-orbit",
    orderedAt: "2026-08-10T16:58:00.000Z",
    orderValue: 18_990,
    category: "Electronics",
    status: "delivered",
    couponCodeUsed: null,
    emailUsed: "arjun.nair@example.test",
    ...overrides,
  };
}

describe("demo scenarios", () => {
  it("keeps ten unique, addressable review paths", () => {
    expect(DEMO_SCENARIOS).toHaveLength(10);
    expect(new Set(DEMO_SCENARIOS.map((scenario) => scenario.key)).size).toBe(10);
    expect(getDemoScenario("app_handoff")?.expectedCode).toBe("NATIVE_APP_HANDOFF");
    expect(getDemoScenario("not-a-scenario")).toBeNull();
  });

  it("includes two scenarios whose input is deliberately messy", () => {
    const messy = DEMO_SCENARIOS.filter((scenario) => scenario.messy);

    expect(messy.map((scenario) => scenario.key)).toEqual([
      "wrong_date",
      "wrong_retailer",
    ]);
  });

  it("falls back to an age-based date when the order cannot be found", () => {
    const scenario = getDemoScenario("vague");
    expect(scenario).not.toBeNull();
    if (!scenario) return;

    const now = new Date("2026-08-20T12:00:00.000Z");
    expect(demoOrderDate(scenario, now)).toBe("2026-08-20T02:00:00.000Z");
    expect(demoSuggestedAnswer(scenario, now)).toBe("2026-08-20");
  });
});

describe("resolveDemoClaimDate", () => {
  const now = new Date("2026-08-21T11:00:00.000Z");

  it("states the date of the seeded order rather than drifting with the clock", () => {
    const scenario = getDemoScenario("real_failure");
    expect(scenario).not.toBeNull();
    if (!scenario) return;

    // Seeded 18 hours before this call, so an age-based date would be 18h out.
    expect(
      resolveDemoClaimDate(scenario, [seededOrder({})], "retailer-orbit", now),
    ).toBe("2026-08-10T16:58:00.000Z");
  });

  it("offsets the stated date for the wrong-date scenario", () => {
    const scenario = getDemoScenario("wrong_date");
    expect(scenario?.claimedDateOffsetHours).toBe(30);
    if (!scenario) return;

    expect(
      resolveDemoClaimDate(scenario, [seededOrder({})], "retailer-orbit", now),
    ).toBe("2026-08-11T22:58:00.000Z");
  });

  it("anchors the wrong-retailer scenario to the retailer actually ordered from", () => {
    const scenario = getDemoScenario("wrong_retailer");
    expect(scenario?.actualRetailerName).toBe("Orbit Electronics");
    expect(scenario?.retailerName).toBe("Nimbus Mart");
  });

  it("picks the order closest to the scenario age when a user has several", () => {
    const scenario = getDemoScenario("real_failure");
    if (!scenario) return;

    const resolved = resolveDemoClaimDate(
      scenario,
      [
        seededOrder({ id: "recent", orderedAt: "2026-08-19T12:58:00.000Z", orderValue: 18_990 }),
        seededOrder({ id: "aged", orderedAt: "2026-08-10T16:58:00.000Z" }),
      ],
      "retailer-orbit",
      now,
    );

    expect(resolved).toBe("2026-08-10T16:58:00.000Z");
  });

  it("ignores orders whose value is nowhere near the claimed amount", () => {
    const scenario = getDemoScenario("real_failure");
    if (!scenario) return;

    expect(
      resolveDemoClaimDate(
        scenario,
        [seededOrder({ orderValue: 48_750 })],
        "retailer-orbit",
        now,
      ),
    ).toBe(demoOrderDate(scenario, now));
  });
});
