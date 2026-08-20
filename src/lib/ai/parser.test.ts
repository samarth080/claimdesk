import { describe, expect, it, vi } from "vitest";

import type { Retailer } from "@/lib/types/domain";

import { parseClaimAtIntake } from "./parser";

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

describe("AI intake parser adapter", () => {
  it("uses the deterministic fallback when no API generator exists", async () => {
    const result = await parseClaimAtIntake({
      rawText: "Nimbus Mart order 6 hours ago for ₹1,849",
      retailers,
      now,
      generator: null,
    });

    expect(result).toMatchObject({
      status: "parsed",
      source: "deterministic_fallback",
      approximateOrderValue: 1_849,
      retailer: { id: "retailer-1" },
    });
  });

  it("accepts strict, validated JSON from a mocked generator", async () => {
    const generator = vi.fn().mockResolvedValue(
      JSON.stringify({
        retailer: "Nimbus Mart",
        approximate_date: "2026-08-18T12:00:00+05:30",
        approximate_value: 2_400,
        volunteered_signals: {
          coupon_mentioned: true,
          coupon_code: "MONSOON20",
          channel: "app",
          cancelled_or_returned: false,
          cart_preloaded: null,
          completed_same_sitting: true,
        },
      }),
    );

    const result = await parseClaimAtIntake({
      rawText: "I bought from Nimbus Mart in the app",
      retailers,
      now,
      generator,
    });

    expect(result).toMatchObject({
      status: "parsed",
      source: "ai",
      approximateOrderValue: 2_400,
      approximateOrderDate: "2026-08-18T12:00:00+05:30",
      retailer: { id: "retailer-1" },
    });
    expect(generator).toHaveBeenCalledOnce();
    expect(generator).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonSchema: expect.objectContaining({ name: "claim_intake" }),
      }),
    );
  });

  it("requests focused manual fields when AI output is invalid", async () => {
    const result = await parseClaimAtIntake({
      rawText: "Some unclear order",
      retailers,
      now,
      generator: vi.fn().mockResolvedValue("```json\n{}\n```"),
    });

    expect(result.status).toBe("manual_required");
  });

  it("accepts a valid manual fallback without calling AI", async () => {
    const generator = vi.fn();
    const result = await parseClaimAtIntake({
      rawText: "Some unclear order",
      retailers,
      now,
      manualDetails: {
        retailerId: "retailer-1",
        orderDate: "2026-08-18",
        orderValue: "2400",
      },
      generator,
    });

    expect(result).toMatchObject({
      status: "parsed",
      source: "manual",
      approximateOrderValue: 2_400,
      retailer: { id: "retailer-1" },
    });
    expect(generator).not.toHaveBeenCalled();
  });
});
