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

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
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
    reason: (ctx) => {
      const { order } = matchEvidence(ctx);
      return order
        ? `Order status is ${order.status}.`
        : "No order matched, so no status could be read.";
    },
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
    reason: (ctx) => {
      const { order } = matchEvidence(ctx);
      const exclusions = ctx.retailer?.excludedCategories.join(", ") || "none";
      return order
        ? `Order category is ${order.category}; retailer excludes ${exclusions}.`
        : "No order matched, so no category could be read.";
    },
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
    reason: (ctx) => {
      const { click } = matchEvidence(ctx);
      if (!click || !ctx.retailer) {
        return "No click or retailer record, so the SLA window cannot be applied.";
      }
      return `Click was ${roundHours(differenceInHours(ctx.now, click.clickedAt))}h ago against a ${ctx.retailer.trackingSlaHours}h SLA.`;
    },
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
    reason: (ctx) => {
      const { cashbackRecord, order } = matchEvidence(ctx);
      if (!order || !ctx.retailer) {
        return "No order or retailer record, so the confirmation window cannot be applied.";
      }
      const status = cashbackRecord ? cashbackRecord.status : "no cashback record";
      return `Order is ${order.status} with ${status}, ${roundHours(differenceInHours(ctx.now, order.orderedAt) / 24)} days into a ${ctx.retailer.confirmationWindowDays}-day window.`;
    },
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
    reason: (ctx) => {
      const { order, preOrderClicks } = matchEvidence(ctx);
      return order
        ? `${preOrderClicks.length} click${preOrderClicks.length === 1 ? "" : "s"} recorded before the matched order.`
        : "No order matched, so no click window could be searched.";
    },
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
    reason: (ctx) => {
      const { click } = matchEvidence(ctx);
      return click
        ? `Click exists, referrer ${click.referrerIntact ? "intact" : "stripped"}.`
        : "No click record, so no referrer could be read.";
    },
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
    reason: (ctx) => {
      const { click } = matchEvidence(ctx);
      if (!click) return "No click record, so no handoff could be read.";
      return `Native-app handoff ${yesNo(click.handoffToNativeApp)}; retailer has a known deep-link issue: ${yesNo(Boolean(ctx.retailer?.knownDeeplinkIssue))}.`;
    },
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
    reason: (ctx) => {
      const { order } = matchEvidence(ctx);
      if (!order) return "No order matched, so no coupon could be read.";
      return `Coupon used: ${order.couponCodeUsed ?? "none"}; retailer allows stacking: ${yesNo(Boolean(ctx.retailer?.allowsCouponStacking))}.`;
    },
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
    reason: (ctx) => {
      const { click, order } = matchEvidence(ctx);
      if (!click || !order) {
        return "No click and order pair, so the 24h session window cannot be measured.";
      }
      return `Order placed ${roundHours(differenceInHours(order.orderedAt, click.clickedAt))}h after the click; the session limit is 24h.`;
    },
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
    reason: (ctx) => {
      const { click } = matchEvidence(ctx);
      if (!click) return "No click record, so cart state could not be read.";
      return `Cart preloaded at click-through: ${yesNo(click.cartPreloaded)}; retailer allows it: ${yesNo(Boolean(ctx.retailer?.allowsCartPreloading))}.`;
    },
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
    reason: (ctx) => {
      const { order } = matchEvidence(ctx);
      return order
        ? `Order email ${order.emailUsed} against account email ${ctx.user.email}.`
        : "No order matched, so no ordering email could be compared.";
    },
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
    reason: (ctx) => {
      const { cashbackRecord, click, order } = matchEvidence(ctx);
      if (!click || !order || !ctx.retailer) {
        return "A clean click, a matched order and a retailer record are all required.";
      }
      const slaElapsed =
        differenceInHours(ctx.now, click.clickedAt) >=
        ctx.retailer.trackingSlaHours;
      return `Click clean: ${yesNo(click.referrerIntact && !isProblematicNativeHandoff(ctx))}; SLA elapsed: ${yesNo(slaElapsed)}; cashback record: ${cashbackRecord ? cashbackRecord.status : "none"}.`;
    },
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
    reason: (ctx) => {
      const { order } = matchEvidence(ctx);
      return order
        ? `Order ${order.id} matched from the claimed retailer, date and value.`
        : "No order matched the claimed retailer, date and value.";
    },
    test: (ctx) => matchEvidence(ctx).order === null,
    confidence: () => 0.55,
    disposition: "needs_input",
    goodwillEligible: false,
    explain: () =>
      "There is not enough information to match this claim to one order yet. We will ask one targeted question and run the same evidence checks again.",
  },
] as const;

export const RULE_PRECEDENCE = RULES.map((rule) => rule.code);
