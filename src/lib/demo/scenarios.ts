import type { DiagnosisCode, Order } from "@/lib/types/domain";

import { addHours } from "@/lib/rules/dates";

export type DemoScenarioKey =
  | "impatient"
  | "ghost_click"
  | "app_handoff"
  | "coupon_detour"
  | "returned_it"
  | "gift_card"
  | "vague"
  | "real_failure"
  | "wrong_date"
  | "wrong_retailer";

export type DemoScenario = {
  key: DemoScenarioKey;
  number: string;
  name: string;
  expectedCode: DiagnosisCode;
  outcome: "Auto-resolve" | "Ask one question" | "Escalate";
  summary: string;
  rawText: string;
  userEmail: string;
  retailerName: string;
  approximateValue: number | null;
  ageHours: number;
  suggestedAnswer?: string;
  /** Retailer the order was actually placed at, when the claim names another. */
  actualRetailerName?: string;
  /** Hours the stated date is deliberately wrong by. */
  claimedDateOffsetHours?: number;
  messy?: "date" | "retailer";
};

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    key: "impatient", number: "01", name: "Impatient",
    expectedCode: "WITHIN_TRACKING_SLA", outcome: "Auto-resolve",
    summary: "A recent order is still inside the retailer's tracking SLA.",
    rawText: "I ordered home supplies from Nimbus Mart about 6 hours ago for ₹1,849 but cashback is not showing.",
    userEmail: "aarav.mehta@example.test", retailerName: "Nimbus Mart",
    approximateValue: 1_849, ageHours: 6,
  },
  {
    key: "ghost_click", number: "02", name: "Ghost click",
    expectedCode: "NO_CLICK_RECORDED", outcome: "Auto-resolve",
    summary: "An order exists, but no eligible click reached the tracking log.",
    rawText: "I bought headphones from Orbit Electronics for ₹12,490. My privacy blocker was on and cashback never appeared.",
    userEmail: "vihaan.bose@example.test", retailerName: "Orbit Electronics",
    approximateValue: 12_490, ageHours: 80,
  },
  {
    key: "app_handoff", number: "03", name: "App handoff",
    expectedCode: "NATIVE_APP_HANDOFF", outcome: "Auto-resolve",
    summary: "A known native-app deep-link break qualifies for goodwill.",
    rawText: "I tapped Cedar & Loom in the cashback app, their app opened, and I finished a ₹1,799 order there.",
    userEmail: "aditi.rao@example.test", retailerName: "Cedar & Loom",
    approximateValue: 1_799, ageHours: 78,
  },
  {
    key: "coupon_detour", number: "04", name: "Coupon detour",
    expectedCode: "COUPON_ATTRIBUTION_LOSS", outcome: "Auto-resolve",
    summary: "An external coupon source took last-click attribution.",
    rawText: "I clicked through for Nimbus Mart, then used SAVEHUB25 from a coupon site before paying ₹3,199.",
    userEmail: "meera.joshi@example.test", retailerName: "Nimbus Mart",
    approximateValue: 3_199, ageHours: 76,
  },
  {
    key: "returned_it", number: "05", name: "Returned it",
    expectedCode: "ORDER_CANCELLED_OR_RETURNED", outcome: "Auto-resolve",
    summary: "A returned order outranks timing and reverses its cashback.",
    rawText: "I returned my Cedar & Loom order three days ago and now the cashback has disappeared.",
    userEmail: "pranav.das@example.test", retailerName: "Cedar & Loom",
    approximateValue: 2_799, ageHours: 168,
  },
  {
    key: "gift_card", number: "06", name: "Gift card",
    expectedCode: "EXCLUDED_CATEGORY", outcome: "Auto-resolve",
    summary: "The matched order belongs to a category excluded by the terms.",
    rawText: "I bought a ₹2,000 gift card from Nimbus Mart today but no cashback tracked.",
    userEmail: "sahil.verma@example.test", retailerName: "Nimbus Mart",
    approximateValue: 2_000, ageHours: 10,
  },
  {
    key: "vague", number: "07", name: "Vague",
    expectedCode: "INSUFFICIENT_EVIDENCE", outcome: "Ask one question",
    summary: "A missing date triggers one high-information question, then resolves.",
    rawText: "cashback nahi aaya, Nimbus Mart se liya tha",
    userEmail: "rohan.bhat@example.test", retailerName: "Nimbus Mart",
    approximateValue: null, ageHours: 10, suggestedAnswer: "order_date",
  },
  {
    key: "real_failure", number: "08", name: "Real failure",
    expectedCode: "GENUINE_TRACKING_FAILURE", outcome: "Escalate",
    summary: "Clean click and order evidence, elapsed SLA, no cashback record.",
    rawText: "I clicked through normally and completed an Orbit Electronics order for ₹18,990 ten days ago. Nothing has tracked.",
    userEmail: "arjun.nair@example.test", retailerName: "Orbit Electronics",
    approximateValue: 18_990, ageHours: 240,
  },
  {
    key: "wrong_date", number: "09", name: "Wrong date",
    expectedCode: "GENUINE_TRACKING_FAILURE", outcome: "Escalate",
    summary: "The stated date is 30 hours out. Tolerant matching still finds the one order it can be.",
    rawText: "Orbit Electronics order about a week back, ₹18,990 or so, cashback still missing.",
    userEmail: "arjun.nair@example.test", retailerName: "Orbit Electronics",
    approximateValue: 18_990, ageHours: 240,
    claimedDateOffsetHours: 30, messy: "date",
  },
  {
    key: "wrong_retailer", number: "10", name: "Wrong retailer",
    expectedCode: "INSUFFICIENT_EVIDENCE", outcome: "Ask one question",
    summary: "The shopper names a retailer they never ordered from, so the one near-miss order is rejected.",
    rawText: "I bought headphones from Nimbus Mart for ₹12,490 and no cashback has tracked.",
    userEmail: "vihaan.bose@example.test", retailerName: "Nimbus Mart",
    actualRetailerName: "Orbit Electronics",
    approximateValue: 12_490, ageHours: 80,
    suggestedAnswer: "order_date", messy: "retailer",
  },
] as const;

const scenariosByKey = new Map(DEMO_SCENARIOS.map((scenario) => [scenario.key, scenario]));

export function isDemoScenarioKey(value: string): value is DemoScenarioKey {
  return scenariosByKey.has(value as DemoScenarioKey);
}

export function getDemoScenario(value: string | undefined): DemoScenario | null {
  return value && isDemoScenarioKey(value) ? scenariosByKey.get(value) ?? null : null;
}

export function demoOrderDate(scenario: DemoScenario, now = new Date()): string {
  return new Date(now.getTime() - scenario.ageHours * 60 * 60 * 1_000).toISOString();
}

export function demoSuggestedAnswer(
  scenario: DemoScenario,
  now = new Date(),
  claimDate?: string,
): string | null {
  return scenario.suggestedAnswer === "order_date"
    ? (claimDate ?? demoOrderDate(scenario, now)).slice(0, 10)
    : null;
}

function valueIsClose(orderValue: number, claimedValue: number): boolean {
  return Math.abs(orderValue - claimedValue) <= Math.max(50, claimedValue * 0.05);
}

/**
 * The date a demo claim states. Seeded orders are written relative to the run
 * time of the seed, so an age-based date drifts past the 36-hour matching
 * tolerance about a day and a half after seeding and every scenario stops
 * matching. Anchoring to the order the scenario is about keeps the demo stable,
 * and lets a scenario be deliberately wrong by a stated number of hours.
 */
export function resolveDemoClaimDate(
  scenario: DemoScenario,
  orders: Order[],
  retailerId: string | null,
  now = new Date(),
): string {
  const candidates = orders.filter(
    (order) =>
      (retailerId === null || order.retailerId === retailerId) &&
      (scenario.approximateValue === null ||
        valueIsClose(order.orderValue, scenario.approximateValue)),
  );
  if (candidates.length === 0) return demoOrderDate(scenario, now);

  const targetAge = scenario.ageHours * 60 * 60 * 1_000;
  const closest = candidates.reduce((best, order) => {
    const ageOf = (candidate: Order) =>
      Math.abs(now.getTime() - new Date(candidate.orderedAt).getTime() - targetAge);
    return ageOf(order) < ageOf(best) ? order : best;
  });

  return addHours(closest.orderedAt, scenario.claimedDateOffsetHours ?? 0);
}
