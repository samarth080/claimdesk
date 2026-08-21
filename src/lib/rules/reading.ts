import type { ClaimContext } from "@/lib/types/domain";

import { differenceInHours } from "./dates";
import { matchEvidence } from "./evidence";

export type EvidenceSource =
  | "click"
  | "order"
  | "cashback"
  | "retailer"
  | "user"
  | "runtime";

export type EvidenceReading = {
  source: EvidenceSource;
  field: string;
  value: string | number | boolean | null;
  found: boolean;
};

function read(
  source: EvidenceSource,
  field: string,
  value: string | number | boolean | null,
): EvidenceReading {
  return { source, field, value, found: value !== null };
}

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Every field the precedence rules can read, in the order a reviewer should
 * read them. A record that does not exist is still listed, with found: false,
 * because an absent click row is itself the evidence NO_CLICK_RECORDED fires on.
 */
export function readEvidence(ctx: ClaimContext): EvidenceReading[] {
  const { click, order, cashbackRecord, preOrderClicks } = matchEvidence(ctx);
  const { retailer } = ctx;

  return [
    read("user", "account_email", ctx.user.email),
    read("user", "tier", ctx.user.tier),
    read("user", "goodwill_credits_90d", ctx.goodwillCreditsInLast90Days),

    read("retailer", "retailer_record", retailer?.name ?? null),
    read("retailer", "tracking_sla_hours", retailer?.trackingSlaHours ?? null),
    read(
      "retailer",
      "confirmation_window_days",
      retailer?.confirmationWindowDays ?? null,
    ),
    read(
      "retailer",
      "excluded_categories",
      retailer ? retailer.excludedCategories.join(", ") || "none" : null,
    ),
    read(
      "retailer",
      "allows_coupon_stacking",
      retailer?.allowsCouponStacking ?? null,
    ),
    read(
      "retailer",
      "allows_cart_preloading",
      retailer?.allowsCartPreloading ?? null,
    ),
    read(
      "retailer",
      "known_deeplink_issue",
      retailer?.knownDeeplinkIssue ?? null,
    ),

    read("order", "order_record", order?.id ?? null),
    read("order", "ordered_at", order?.orderedAt ?? null),
    read("order", "order_value", order?.orderValue ?? null),
    read("order", "category", order?.category ?? null),
    read("order", "status", order?.status ?? null),
    read("order", "coupon_code_used", order?.couponCodeUsed ?? null),
    read("order", "email_used", order?.emailUsed ?? null),

    read("click", "click_record", click?.clickId ?? null),
    read("click", "clicked_at", click?.clickedAt ?? null),
    read("click", "device", click?.device ?? null),
    read("click", "referrer_intact", click?.referrerIntact ?? null),
    read("click", "handoff_to_native_app", click?.handoffToNativeApp ?? null),
    read("click", "cart_preloaded", click?.cartPreloaded ?? null),
    read("click", "pre_order_click_count", order ? preOrderClicks.length : null),

    read("cashback", "cashback_record", cashbackRecord?.id ?? null),
    read("cashback", "cashback_status", cashbackRecord?.status ?? null),
    read("cashback", "cashback_amount", cashbackRecord?.amount ?? null),
    read("cashback", "reported_at", cashbackRecord?.reportedAt ?? null),

    read("runtime", "evaluated_at", ctx.now),
    read("runtime", "claimed_retailer_id", ctx.claim.claimedRetailerId),
    read("runtime", "claimed_order_date", ctx.claim.claimedOrderDate),
    read("runtime", "claimed_order_value", ctx.claim.claimedOrderValue),
    read(
      "runtime",
      "hours_since_click",
      click ? roundHours(differenceInHours(ctx.now, click.clickedAt)) : null,
    ),
    read(
      "runtime",
      "hours_click_to_order",
      click && order
        ? roundHours(differenceInHours(order.orderedAt, click.clickedAt))
        : null,
    ),
    read(
      "runtime",
      "days_since_order",
      order
        ? roundHours(differenceInHours(ctx.now, order.orderedAt) / 24)
        : null,
    ),
  ];
}
