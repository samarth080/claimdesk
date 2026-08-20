import { describe, expect, it } from "vitest";

import { matchEvidence, matchOrder } from "../evidence";
import { makeContext } from "./fixtures";

describe("claim evidence matching", () => {
  it("accepts an approximate intake date and value within policy tolerances", () => {
    const ctx = makeContext({
      claim: {
        claimedOrderDate: "2026-08-16T12:00:00.000Z",
        claimedOrderValue: 1_045,
      },
    });

    expect(matchOrder(ctx)?.id).toBe("order-1");
  });

  it("requires at least an approximate date or value", () => {
    const ctx = makeContext({
      claim: { claimedOrderDate: null, claimedOrderValue: null },
    });

    expect(matchOrder(ctx)).toBeNull();
  });

  it("chooses the closest deterministic match when two orders qualify", () => {
    const base = makeContext();
    const fartherOrder = {
      ...base.orders[0],
      id: "order-2",
      orderedAt: "2026-08-16T00:00:00.000Z",
      orderValue: 1_030,
    };
    const ctx = {
      ...base,
      orders: [fartherOrder, base.orders[0]],
    };

    expect(matchOrder(ctx)?.id).toBe("order-1");
  });

  it("does not treat a click after checkout as a pre-order click", () => {
    const ctx = makeContext({
      click: { clickedAt: "2026-08-15T13:00:00.000Z" },
    });

    expect(matchEvidence(ctx).click).toBeNull();
    expect(matchEvidence(ctx).preOrderClicks).toHaveLength(0);
  });
});
