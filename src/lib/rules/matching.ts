import type { ClaimContext, Order } from "@/lib/types/domain";

import { differenceInHours, formatRupees } from "./dates";

export const ORDER_DATE_TOLERANCE_HOURS = 36;

export function valueTolerance(claimedValue: number): number {
  return Math.max(50, claimedValue * 0.05);
}

export type MatchConstraint = "user" | "retailer" | "date" | "value";

export type MatchExclusion = {
  constraint: MatchConstraint;
  detail: string;
};

export type OrderCandidate = {
  orderId: string;
  retailerId: string;
  orderedAt: string;
  orderValue: number;
  passed: boolean;
  selected: boolean;
  dateDistanceHours: number | null;
  valueDistance: number | null;
  exclusions: MatchExclusion[];
};

export type OrderMatchExplanation = {
  attempted: boolean;
  headline: string;
  toleranceHours: number;
  valueToleranceRupees: number | null;
  matchedOrderId: string | null;
  candidates: OrderCandidate[];
};

type ExplainOptions = {
  retailerNames?: Record<string, string>;
};

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function dateDistance(ctx: ClaimContext, order: Order): number | null {
  return ctx.claim.claimedOrderDate
    ? Math.abs(differenceInHours(order.orderedAt, ctx.claim.claimedOrderDate))
    : null;
}

function valueDistance(ctx: ClaimContext, order: Order): number | null {
  return ctx.claim.claimedOrderValue !== null
    ? Math.abs(order.orderValue - ctx.claim.claimedOrderValue)
    : null;
}

/**
 * Every constraint this order fails. The matcher accepts an order when this is
 * empty, so both the selection and its explanation read from one place.
 */
export function orderExclusions(
  ctx: ClaimContext,
  order: Order,
  options: ExplainOptions = {},
): MatchExclusion[] {
  const { claim } = ctx;
  const exclusions: MatchExclusion[] = [];
  const name = (id: string) => options.retailerNames?.[id] ?? id;

  if (order.userId !== claim.userId) {
    exclusions.push({
      constraint: "user",
      detail: "Order belongs to a different account.",
    });
  }

  if (claim.claimedRetailerId && order.retailerId !== claim.claimedRetailerId) {
    exclusions.push({
      constraint: "retailer",
      detail: `Placed at ${name(order.retailerId)}, not the stated ${name(claim.claimedRetailerId)}.`,
    });
  }

  const dateGap = dateDistance(ctx, order);
  if (dateGap !== null && dateGap > ORDER_DATE_TOLERANCE_HOURS) {
    exclusions.push({
      constraint: "date",
      detail: `Ordered ${roundHours(dateGap)} h from the stated date, outside the ${ORDER_DATE_TOLERANCE_HOURS} h tolerance.`,
    });
  }

  const gap = valueDistance(ctx, order);
  if (
    gap !== null &&
    claim.claimedOrderValue !== null &&
    gap > valueTolerance(claim.claimedOrderValue)
  ) {
    exclusions.push({
      constraint: "value",
      detail: `Order value ${formatRupees(order.orderValue)} sits outside the ${formatRupees(claim.claimedOrderValue)} ± ${formatRupees(Math.round(valueTolerance(claim.claimedOrderValue)))} band.`,
    });
  }

  return exclusions;
}

export function orderScore(ctx: ClaimContext, order: Order): number {
  const dateScore = ctx.claim.claimedOrderDate
    ? Math.abs(differenceInHours(order.orderedAt, ctx.claim.claimedOrderDate)) /
      ORDER_DATE_TOLERANCE_HOURS
    : 0;
  const valueScore = ctx.claim.claimedOrderValue
    ? Math.abs(order.orderValue - ctx.claim.claimedOrderValue) /
      valueTolerance(ctx.claim.claimedOrderValue)
    : 0;

  return dateScore + valueScore;
}

export function canAttemptMatch(ctx: ClaimContext): boolean {
  return Boolean(
    ctx.claim.claimedOrderDate || ctx.claim.claimedOrderValue !== null,
  );
}

/**
 * The matching decision with its workings: which orders were considered, and
 * which constraint rejected each one. Selection here always agrees with
 * matchOrder, because both read orderExclusions and orderScore.
 */
export function explainOrderMatch(
  ctx: ClaimContext,
  options: ExplainOptions = {},
): OrderMatchExplanation {
  const toleranceRupees =
    ctx.claim.claimedOrderValue !== null
      ? Math.round(valueTolerance(ctx.claim.claimedOrderValue))
      : null;

  if (!canAttemptMatch(ctx)) {
    return {
      attempted: false,
      headline:
        "No match was attempted: the claim states neither an order date nor a value.",
      toleranceHours: ORDER_DATE_TOLERANCE_HOURS,
      valueToleranceRupees: toleranceRupees,
      matchedOrderId: null,
      candidates: [],
    };
  }

  const scored = ctx.orders.map((order) => ({
    order,
    exclusions: orderExclusions(ctx, order, options),
  }));
  const selected = scored
    .filter((entry) => entry.exclusions.length === 0)
    .sort((left, right) => orderScore(ctx, left.order) - orderScore(ctx, right.order))[0];

  const candidates: OrderCandidate[] = scored.map((entry) => ({
    orderId: entry.order.id,
    retailerId: entry.order.retailerId,
    orderedAt: entry.order.orderedAt,
    orderValue: entry.order.orderValue,
    passed: entry.exclusions.length === 0,
    selected: entry.order.id === selected?.order.id,
    dateDistanceHours: (() => {
      const gap = dateDistance(ctx, entry.order);
      return gap === null ? null : roundHours(gap);
    })(),
    valueDistance: valueDistance(ctx, entry.order),
    exclusions: entry.exclusions,
  }));
  const passing = candidates.filter((candidate) => candidate.passed).length;

  return {
    attempted: true,
    headline: selected
      ? `${passing} of ${candidates.length} order${candidates.length === 1 ? "" : "s"} on this account cleared every constraint; the closest was selected.`
      : `None of the ${candidates.length} order${candidates.length === 1 ? "" : "s"} on this account cleared every constraint.`,
    toleranceHours: ORDER_DATE_TOLERANCE_HOURS,
    valueToleranceRupees: toleranceRupees,
    matchedOrderId: selected?.order.id ?? null,
    candidates,
  };
}
