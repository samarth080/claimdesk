import type { DiagnosisCode } from "@/lib/types/domain";

export type DemoScenarioKey =
  | "impatient"
  | "ghost_click"
  | "app_handoff"
  | "coupon_detour"
  | "returned_it"
  | "gift_card"
  | "vague"
  | "real_failure";

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

export function demoSuggestedAnswer(scenario: DemoScenario, now = new Date()): string | null {
  return scenario.suggestedAnswer === "order_date"
    ? demoOrderDate(scenario, now).slice(0, 10)
    : null;
}
