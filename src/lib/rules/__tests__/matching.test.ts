import { describe, expect, it } from "vitest";

import type { Order } from "@/lib/types/domain";

import { matchOrder } from "../evidence";
import { explainOrderMatch } from "../matching";
import { makeContext } from "./fixtures";

function order(overrides: Partial<Order>): Order {
  return {
    id: "order-x",
    userId: "user-1",
    retailerId: "retailer-1",
    orderedAt: "2026-08-15T12:00:00.000Z",
    orderValue: 1_000,
    category: "Home",
    status: "delivered",
    couponCodeUsed: null,
    emailUsed: "person@example.test",
    ...overrides,
  };
}

describe("explainOrderMatch", () => {
  it("selects the same order the matcher selects", () => {
    const contexts = [
      makeContext(),
      makeContext({ order: null, click: null }),
      makeContext({
        orders: [
          order({ id: "near", orderedAt: "2026-08-15T18:00:00.000Z" }),
          order({ id: "far", orderedAt: "2026-08-13T12:00:00.000Z" }),
        ],
      }),
    ];

    for (const ctx of contexts) {
      expect(explainOrderMatch(ctx).matchedOrderId).toBe(
        matchOrder(ctx)?.id ?? null,
      );
    }
  });

  it("names the retailer constraint when the claimed retailer is wrong", () => {
    const ctx = makeContext({
      claim: { claimedRetailerId: "retailer-2" },
      orders: [order({ id: "real-order" })],
    });
    const explanation = explainOrderMatch(ctx);
    const candidate = explanation.candidates.find(
      (entry) => entry.orderId === "real-order",
    );

    expect(explanation.matchedOrderId).toBeNull();
    expect(candidate?.passed).toBe(false);
    expect(candidate?.exclusions).toHaveLength(1);
    expect(candidate?.exclusions[0]?.constraint).toBe("retailer");
  });

  it("reports how far a date sits from the stated one against the tolerance", () => {
    const ctx = makeContext({
      claim: { claimedOrderDate: "2026-08-15T12:00:00.000Z" },
      orders: [order({ id: "inside", orderedAt: "2026-08-16T12:00:00.000Z" })],
    });
    const candidate = explainOrderMatch(ctx).candidates[0];

    expect(candidate?.passed).toBe(true);
    expect(candidate?.dateDistanceHours).toBe(24);
    expect(explainOrderMatch(ctx).toleranceHours).toBe(36);
  });

  it("excludes an order whose value is outside the tolerance band", () => {
    const ctx = makeContext({
      claim: { claimedOrderValue: 1_000 },
      orders: [order({ id: "pricey", orderValue: 4_000 })],
    });
    const candidate = explainOrderMatch(ctx).candidates[0];

    expect(candidate?.passed).toBe(false);
    expect(candidate?.exclusions[0]?.constraint).toBe("value");
    expect(candidate?.exclusions[0]?.detail).toContain("₹4,000");
  });

  it("does not attempt a match when the claim states neither date nor value", () => {
    const explanation = explainOrderMatch(
      makeContext({
        claim: { claimedOrderDate: null, claimedOrderValue: null },
      }),
    );

    expect(explanation.attempted).toBe(false);
    expect(explanation.matchedOrderId).toBeNull();
    expect(explanation.candidates).toHaveLength(0);
  });
});
