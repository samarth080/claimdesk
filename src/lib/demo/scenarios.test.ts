import { describe, expect, it } from "vitest";

import {
  DEMO_SCENARIOS,
  demoOrderDate,
  demoSuggestedAnswer,
  getDemoScenario,
} from "./scenarios";

describe("demo scenarios", () => {
  it("keeps eight unique, addressable review paths", () => {
    expect(DEMO_SCENARIOS).toHaveLength(8);
    expect(new Set(DEMO_SCENARIOS.map((scenario) => scenario.key)).size).toBe(8);
    expect(getDemoScenario("app_handoff")?.expectedCode).toBe("NATIVE_APP_HANDOFF");
    expect(getDemoScenario("not-a-scenario")).toBeNull();
  });

  it("gives the vague scenario a usable seeded order date", () => {
    const scenario = getDemoScenario("vague");
    expect(scenario).not.toBeNull();
    if (!scenario) return;

    const now = new Date("2026-08-20T12:00:00.000Z");
    expect(demoOrderDate(scenario, now)).toBe("2026-08-20T02:00:00.000Z");
    expect(demoSuggestedAnswer(scenario, now)).toBe("2026-08-20");
  });
});
