import type {
  CashbackRecord,
  ClaimContext,
  Click,
  Order,
} from "@/lib/types/domain";

import { differenceInHours } from "./dates";

const ORDER_DATE_TOLERANCE_HOURS = 36;

export type MatchedEvidence = {
  order: Order | null;
  click: Click | null;
  cashbackRecord: CashbackRecord | null;
  preOrderClicks: Click[];
};

function valueTolerance(claimedValue: number): number {
  return Math.max(50, claimedValue * 0.05);
}

function orderScore(ctx: ClaimContext, order: Order): number {
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

export function matchOrder(ctx: ClaimContext): Order | null {
  const { claim } = ctx;
  if (!claim.claimedOrderDate && claim.claimedOrderValue === null) return null;

  const candidates = ctx.orders.filter((order) => {
    if (order.userId !== claim.userId) return false;
    if (
      claim.claimedRetailerId &&
      order.retailerId !== claim.claimedRetailerId
    ) {
      return false;
    }

    if (
      claim.claimedOrderDate &&
      Math.abs(differenceInHours(order.orderedAt, claim.claimedOrderDate)) >
        ORDER_DATE_TOLERANCE_HOURS
    ) {
      return false;
    }

    if (
      claim.claimedOrderValue !== null &&
      Math.abs(order.orderValue - claim.claimedOrderValue) >
        valueTolerance(claim.claimedOrderValue)
    ) {
      return false;
    }

    return true;
  });

  return candidates.sort((left, right) => orderScore(ctx, left) - orderScore(ctx, right))[0] ?? null;
}

export function findPreOrderClicks(ctx: ClaimContext, order: Order): Click[] {
  return ctx.clicks
    .filter(
      (click) =>
        click.userId === order.userId &&
        click.retailerId === order.retailerId &&
        new Date(click.clickedAt).getTime() <= new Date(order.orderedAt).getTime(),
    )
    .sort(
      (left, right) =>
        new Date(right.clickedAt).getTime() - new Date(left.clickedAt).getTime(),
    );
}

export function matchEvidence(ctx: ClaimContext): MatchedEvidence {
  const order = matchOrder(ctx);
  if (!order) {
    return {
      order: null,
      click: null,
      cashbackRecord: null,
      preOrderClicks: [],
    };
  }

  const preOrderClicks = findPreOrderClicks(ctx, order);
  const click = preOrderClicks[0] ?? null;
  const cashbackRecord =
    ctx.cashbackRecords.find((record) => record.orderId === order.id) ??
    (click
      ? ctx.cashbackRecords.find((record) => record.clickId === click.id)
      : undefined) ??
    null;

  return { order, click, cashbackRecord, preOrderClicks };
}

export const MATCHING_POLICY = {
  orderDateToleranceHours: ORDER_DATE_TOLERANCE_HOURS,
  valueTolerance,
} as const;
