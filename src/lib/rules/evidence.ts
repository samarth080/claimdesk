import type {
  CashbackRecord,
  ClaimContext,
  Click,
  Order,
} from "@/lib/types/domain";

import {
  canAttemptMatch,
  ORDER_DATE_TOLERANCE_HOURS,
  orderExclusions,
  orderScore,
  valueTolerance,
} from "./matching";

export type MatchedEvidence = {
  order: Order | null;
  click: Click | null;
  cashbackRecord: CashbackRecord | null;
  preOrderClicks: Click[];
};

export function matchOrder(ctx: ClaimContext): Order | null {
  if (!canAttemptMatch(ctx)) return null;

  return (
    ctx.orders
      .filter((order) => orderExclusions(ctx, order).length === 0)
      .sort((left, right) => orderScore(ctx, left) - orderScore(ctx, right))[0] ??
    null
  );
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
