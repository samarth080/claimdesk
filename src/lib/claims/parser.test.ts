import { describe, expect, it } from "vitest";

import type { Retailer } from "@/lib/types/domain";

import { parseClaimDeterministically } from "./parser";

const retailers: Retailer[] = [
  {
    id: "retailer-1",
    name: "Nimbus Mart",
    trackingSlaHours: 24,
    confirmationWindowDays: 30,
    excludedCategories: [],
    allowsCouponStacking: false,
    allowsCartPreloading: false,
    knownDeeplinkIssue: false,
    termsUrl: "https://example.com/terms",
  },
];
const now = new Date("2026-08-20T12:00:00.000Z");

describe("temporary deterministic intake parser", () => {
  it("extracts the seeded impatient claim", () => {
    const result = parseClaimDeterministically(
      "I ordered from Nimbus Mart 6 hours ago for ₹1,849.",
      retailers,
      now,
    );

    expect(result.retailer?.id).toBe("retailer-1");
    expect(result.approximateOrderValue).toBe(1_849);
    expect(result.approximateOrderDate).toBe("2026-08-20T06:00:00.000Z");
  });

  it("accepts plain-number Indian English phrasing", () => {
    const result = parseClaimDeterministically(
      "Nimbus Mart order for like 2400 rupees yesterday",
      retailers,
      now,
    );

    expect(result.approximateOrderValue).toBe(2_400);
    expect(result.approximateOrderDate).toBe("2026-08-19T12:00:00.000Z");
  });

  it("leaves genuinely missing fields unknown", () => {
    const result = parseClaimDeterministically(
      "cashback nahi aaya",
      retailers,
      now,
    );

    expect(result).toEqual({
      retailer: null,
      approximateOrderValue: null,
      approximateOrderDate: null,
    });
  });
});
