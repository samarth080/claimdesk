import type { ClaimContext, Rule } from "@/lib/types/domain";

import {
  addDays,
  addHours,
  differenceInHours,
  formatIndiaDate,
  formatIndiaDateTime,
  formatRupees,
} from "./dates";
import { matchEvidence } from "./evidence";

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase("en-IN");
}

function hasExcludedCategory(ctx: ClaimContext): boolean {
  const { order } = matchEvidence(ctx);
  return Boolean(
    order &&
      ctx.retailer?.excludedCategories.some(
        (category) => normalise(category) === normalise(order.category),
      ),
  );
}

function usedExternalCoupon(ctx: ClaimContext): boolean {
  const { order } = matchEvidence(ctx);
  if (!order?.couponCodeUsed || ctx.retailer?.allowsCouponStacking !== false) {
    return false;
  }

  const platformCodes = new Set(
    ctx.platformCouponCodes.map((code) => normalise(code)),
  );
  return !platformCodes.has(normalise(order.couponCodeUsed));
}

function isProblematicNativeHandoff(ctx: ClaimContext): boolean {
  const { click } = matchEvidence(ctx);
  return Boolean(
    click?.handoffToNativeApp && ctx.retailer?.knownDeeplinkIssue,
  );
}

export const RULES: readonly Rule[] = [
  {
    code: "ORDER_CANCELLED_OR_RETURNED",
    test: (ctx) => {
      const { order } = matchEvidence(ctx);
      return order?.status === "cancelled" || order?.status === "returned";
    },
    confidence: () => 0.99,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      const status = order?.status === "returned" ? "returned" : "cancelled";
      return `The ${formatRupees(order?.orderValue ?? 0)} order was ${status}. Cashback reverses when the underlying order is ${status}, so no cashback will be paid for this purchase.`;
    },
  },
  {
    code: "EXCLUDED_CATEGORY",
    test: hasExcludedCategory,
    confidence: () => 0.99,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      return `${order?.category ?? "This category"} is excluded from cashback by ${ctx.retailer?.name ?? "the retailer"}. The order value was ${formatRupees(order?.orderValue ?? 0)}. You can check the applicable terms at ${ctx.retailer?.termsUrl ?? "the retailer terms page"}.`;
    },
  },
  {
    code: "WITHIN_TRACKING_SLA",
    test: (ctx) => {
      const { click, order } = matchEvidence(ctx);
      return Boolean(
        click &&
          order &&
          ctx.retailer &&
          differenceInHours(ctx.now, click.clickedAt) >= 0 &&
          differenceInHours(ctx.now, click.clickedAt) <
            ctx.retailer.trackingSlaHours,
      );
    },
    confidence: () => 0.99,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) => {
      const { click } = matchEvidence(ctx);
      const dueAt = addHours(
        click?.clickedAt ?? ctx.now,
        ctx.retailer?.trackingSlaHours ?? 0,
      );
      return `Your click was recorded and is still inside ${ctx.retailer?.name ?? "the retailer"}'s ${ctx.retailer?.trackingSlaHours ?? 0}-hour tracking window. It is due to appear by ${formatIndiaDateTime(dueAt)}. There is nothing you need to submit before then.`;
    },
  },
  {
    code: "PENDING_CONFIRMATION_WINDOW",
    test: (ctx) => {
      const { cashbackRecord, order } = matchEvidence(ctx);
      return Boolean(
        order?.status === "delivered" &&
          cashbackRecord?.status === "pending" &&
          ctx.retailer &&
          differenceInHours(ctx.now, order.orderedAt) <
            ctx.retailer.confirmationWindowDays * 24,
      );
    },
    confidence: () => 0.99,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      const dueDate = addDays(
        order?.orderedAt ?? ctx.now,
        ctx.retailer?.confirmationWindowDays ?? 0,
      );
      return `Your cashback is tracked as pending. ${ctx.retailer?.name ?? "The retailer"} has until ${formatIndiaDate(dueDate)} to confirm the delivered order. The status will update after that confirmation; pending does not mean the cashback is missing.`;
    },
  },
  {
    code: "NO_CLICK_RECORDED",
    test: (ctx) => {
      const { order, preOrderClicks } = matchEvidence(ctx);
      return Boolean(order && preOrderClicks.length === 0);
    },
    confidence: () => 0.94,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      return `We found the ${formatRupees(order?.orderValue ?? 0)} order but no cashback click before it. An ad blocker, privacy browser or cookie restriction can remove the referral before it reaches us. For a future purchase, start from the cashback link, allow tracking for that visit and complete checkout without opening another shopping tab.`;
    },
  },
  {
    code: "REFERRER_STRIPPED",
    test: (ctx) => matchEvidence(ctx).click?.referrerIntact === false,
    confidence: () => 0.98,
    disposition: "auto_resolve",
    goodwillEligible: true,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      return `We recorded the visit and the ${formatRupees(order?.orderValue ?? 0)} order, but the referral details were stripped before they reached the retailer. That prevents reliable attribution. This is a platform-side tracking loss, so the claim will be checked against the written goodwill-credit policy.`;
    },
  },
  {
    code: "NATIVE_APP_HANDOFF",
    test: isProblematicNativeHandoff,
    confidence: () => 0.99,
    disposition: "auto_resolve",
    goodwillEligible: true,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      return `Our link handed you into ${ctx.retailer?.name ?? "the retailer"}'s native app through a known broken deep link, so the ${formatRupees(order?.orderValue ?? 0)} order lost attribution. This is on us. The claim will now be checked against the written goodwill-credit policy.`;
    },
  },
  {
    code: "COUPON_ATTRIBUTION_LOSS",
    test: usedExternalCoupon,
    confidence: () => 0.97,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      return `The order used ${order?.couponCodeUsed ?? "an external coupon"}, which is not in our coupon set. ${ctx.retailer?.name ?? "This retailer"} does not allow coupon stacking, so the coupon source became the final referrer at checkout. That changed attribution, which means cashback will not be paid on this order.`;
    },
  },
  {
    code: "SESSION_EXPIRED",
    test: (ctx) => {
      const { click, order } = matchEvidence(ctx);
      return Boolean(
        click &&
          order &&
          differenceInHours(order.orderedAt, click.clickedAt) > 24,
      );
    },
    confidence: () => 0.98,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) => {
      const { click, order } = matchEvidence(ctx);
      const elapsed = Math.floor(
        differenceInHours(
          order?.orderedAt ?? ctx.now,
          click?.clickedAt ?? ctx.now,
        ),
      );
      return `The purchase was completed ${elapsed} hours after the recorded click. Cashback sessions expire after 24 hours, so this order fell outside the eligible visit. For a future order, open a fresh cashback link immediately before checkout.`;
    },
  },
  {
    code: "CART_PRELOADED",
    test: (ctx) => {
      const { click } = matchEvidence(ctx);
      return Boolean(
        click?.cartPreloaded && ctx.retailer?.allowsCartPreloading === false,
      );
    },
    confidence: () => 0.96,
    disposition: "auto_resolve",
    goodwillEligible: false,
    explain: (ctx) =>
      `The basket already contained items when the cashback visit began. ${ctx.retailer?.name ?? "This retailer"} requires an empty cart at click-through, so the order is not eligible. For a future purchase, empty the basket first, use a fresh cashback link and then add the items again.`,
  },
  {
    code: "ACCOUNT_MISMATCH",
    test: (ctx) => {
      const { order } = matchEvidence(ctx);
      return Boolean(
        order && normalise(order.emailUsed) !== normalise(ctx.user.email),
      );
    },
    confidence: () => 0.99,
    disposition: "needs_input",
    goodwillEligible: false,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      return `The matched order used ${order?.emailUsed ?? "a different email"}, while this cashback account uses ${ctx.user.email}. Please confirm which email you ordered with so we can attach the correct evidence before a human review.`;
    },
  },
  {
    code: "GENUINE_TRACKING_FAILURE",
    test: (ctx) => {
      const { cashbackRecord, click, order } = matchEvidence(ctx);
      if (!click || !order || !ctx.retailer) return false;

      const cleanClick =
        click.referrerIntact &&
        !isProblematicNativeHandoff(ctx) &&
        !(click.cartPreloaded && !ctx.retailer.allowsCartPreloading);
      const slaElapsed =
        differenceInHours(ctx.now, click.clickedAt) >=
        ctx.retailer.trackingSlaHours;
      const accountMatches = normalise(order.emailUsed) === normalise(ctx.user.email);

      return (
        cleanClick &&
        slaElapsed &&
        accountMatches &&
        !usedExternalCoupon(ctx) &&
        !hasExcludedCategory(ctx) &&
        cashbackRecord === null
      );
    },
    confidence: () => 0.98,
    disposition: "escalate_network",
    goodwillEligible: false,
    explain: (ctx) => {
      const { order } = matchEvidence(ctx);
      return `We found a clean click and matched the ${formatRupees(order?.orderValue ?? 0)} order from ${formatIndiaDate(order?.orderedAt ?? ctx.now)}. The tracking SLA has elapsed and no cashback record exists. This is a genuine tracking failure, so a complete case is being sent to the affiliate network for validation.`;
    },
  },
  {
    code: "INSUFFICIENT_EVIDENCE",
    test: (ctx) => matchEvidence(ctx).order === null,
    confidence: () => 0.55,
    disposition: "needs_input",
    goodwillEligible: false,
    explain: () =>
      "There is not enough information to match this claim to one order yet. We will ask one targeted question and run the same evidence checks again.",
  },
] as const;

export const RULE_PRECEDENCE = RULES.map((rule) => rule.code);
