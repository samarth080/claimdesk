import type { DiagnosisCode } from "@/lib/types/domain";

import type { EvidenceSource } from "@/lib/rules/reading";

export const DIAGNOSIS_LABELS: Record<DiagnosisCode, string> = {
  WITHIN_TRACKING_SLA: "Inside tracking SLA",
  PENDING_CONFIRMATION_WINDOW: "Pending confirmation",
  ORDER_CANCELLED_OR_RETURNED: "Cancelled or returned",
  EXCLUDED_CATEGORY: "Excluded category",
  NO_CLICK_RECORDED: "No click recorded",
  REFERRER_STRIPPED: "Referrer stripped",
  NATIVE_APP_HANDOFF: "Native app handoff",
  COUPON_ATTRIBUTION_LOSS: "Coupon attribution loss",
  SESSION_EXPIRED: "Session expired",
  CART_PRELOADED: "Cart preloaded",
  ACCOUNT_MISMATCH: "Account mismatch",
  GENUINE_TRACKING_FAILURE: "Genuine tracking failure",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
};

/** What each rule's evidence test asks, in one line. */
export const RULE_EVIDENCE_TESTS: Record<DiagnosisCode, string> = {
  ORDER_CANCELLED_OR_RETURNED: "Order status is cancelled or returned.",
  EXCLUDED_CATEGORY: "Order category appears in the retailer exclusion list.",
  WITHIN_TRACKING_SLA: "Matched click and order are still inside tracking SLA.",
  PENDING_CONFIRMATION_WINDOW:
    "Pending cashback is inside the retailer confirmation window.",
  NO_CLICK_RECORDED: "No eligible pre-order click exists in the tracking log.",
  REFERRER_STRIPPED: "Matched click arrived without intact referral data.",
  NATIVE_APP_HANDOFF:
    "Native app handoff occurred for a retailer with a known deep-link issue.",
  COUPON_ATTRIBUTION_LOSS:
    "External coupon was used where coupon stacking is not allowed.",
  SESSION_EXPIRED: "Order was completed more than 24 hours after the click.",
  CART_PRELOADED:
    "Cart contained items before click-through and retailer disallows it.",
  ACCOUNT_MISMATCH: "Ordering email differs from cashback account email.",
  GENUINE_TRACKING_FAILURE:
    "Clean click and order exist, SLA elapsed, and no cashback record exists.",
  INSUFFICIENT_EVIDENCE: "No order can be matched to the submitted claim.",
};

export const EVIDENCE_SOURCE_ORDER: readonly EvidenceSource[] = [
  "user",
  "retailer",
  "order",
  "click",
  "cashback",
  "runtime",
] as const;

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSource, string> = {
  user: "Account",
  retailer: "Retailer terms",
  order: "Order record",
  click: "Click log",
  cashback: "Cashback ledger",
  runtime: "Claim input and timing",
};

export const EVIDENCE_SOURCE_NOTES: Record<EvidenceSource, string> = {
  user: "The cashback account this claim was filed from.",
  retailer: "Published terms for the matched retailer.",
  order: "The one order matched from retailer, date and value.",
  click: "The most recent click for this retailer before the order.",
  cashback: "Any cashback row linked to that click or order.",
  runtime: "What the claim itself stated, and the intervals computed from it.",
};

export const EVIDENCE_FIELD_LABELS: Record<string, string> = {
  account_email: "Cashback account email",
  tier: "Account tier",
  goodwill_credits_90d: "Goodwill credits in 90 days",

  retailer_record: "Retailer",
  tracking_sla_hours: "Tracking SLA",
  confirmation_window_days: "Confirmation window",
  excluded_categories: "Excluded categories",
  allows_coupon_stacking: "Allows coupon stacking",
  allows_cart_preloading: "Allows a preloaded cart",
  known_deeplink_issue: "Known deep-link issue",

  order_record: "Order",
  ordered_at: "Ordered at",
  order_value: "Order value",
  category: "Category",
  status: "Order status",
  coupon_code_used: "Coupon used",
  email_used: "Email on the order",

  click_record: "Click record",
  clicked_at: "Clicked at",
  device: "Device",
  referrer_intact: "Referrer intact",
  handoff_to_native_app: "Handed off to native app",
  cart_preloaded: "Cart preloaded at click",
  pre_order_click_count: "Clicks before the order",

  cashback_record: "Cashback record",
  cashback_status: "Cashback status",
  cashback_amount: "Cashback amount",
  reported_at: "Reported at",

  evaluated_at: "Evaluated at",
  claimed_retailer_id: "Retailer parsed from the claim",
  claimed_order_date: "Date stated in the claim",
  claimed_order_value: "Value stated in the claim",
  hours_since_click: "Time since the click",
  hours_click_to_order: "Click to order",
  days_since_order: "Time since the order",
};

/**
 * What to print when a field has no value. A missing row is evidence, so it
 * gets a sentence rather than a dash.
 */
export const EVIDENCE_MISSING_NOTES: Record<string, string> = {
  retailer_record: "No retailer identified from the claim",
  order_record: "No order matched the retailer, date and value",
  click_record: "None found for this retailer before the order",
  cashback_record: "No row linked to the click or order",
  coupon_code_used: "None recorded",
  reported_at: "Never reported",
  claimed_retailer_id: "Not identified from the claim",
  claimed_order_date: "Not stated in the claim",
  claimed_order_value: "Not stated in the claim",
  pre_order_click_count: "No order to search against",
};

export const DEVICE_LABELS: Record<string, string> = {
  android_app: "Android app",
  ios_app: "iOS app",
  mweb: "Mobile web",
  desktop: "Desktop web",
};
