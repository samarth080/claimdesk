import type { Tables } from "@/lib/types/database";
import type {
  CashbackRecord,
  Claim,
  Click,
  Order,
  Retailer,
  User,
} from "@/lib/types/domain";

export function mapUser(row: Tables<"users">): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    signupDate: row.signup_date,
    lifetimeCashback: row.lifetime_cashback,
    tier: row.tier,
  };
}

export function mapRetailer(row: Tables<"retailers">): Retailer {
  return {
    id: row.id,
    name: row.name,
    trackingSlaHours: row.tracking_sla_hours,
    confirmationWindowDays: row.confirmation_window_days,
    excludedCategories: row.excluded_categories,
    allowsCouponStacking: row.allows_coupon_stacking,
    allowsCartPreloading: row.allows_cart_preloading,
    knownDeeplinkIssue: row.known_deeplink_issue,
    termsUrl: row.terms_url,
  };
}

export function mapClick(row: Tables<"clicks">): Click {
  return {
    id: row.id,
    userId: row.user_id,
    retailerId: row.retailer_id,
    clickedAt: row.clicked_at,
    clickId: row.click_id,
    device: row.device,
    handoffToNativeApp: row.handoff_to_native_app,
    referrerIntact: row.referrer_intact,
    cartPreloaded: row.cart_preloaded,
  };
}

export function mapOrder(row: Tables<"orders">): Order {
  return {
    id: row.id,
    userId: row.user_id,
    retailerId: row.retailer_id,
    orderedAt: row.ordered_at,
    orderValue: row.order_value,
    category: row.category,
    status: row.status,
    couponCodeUsed: row.coupon_code_used,
    emailUsed: row.email_used,
  };
}

export function mapCashbackRecord(
  row: Tables<"cashback_records">,
): CashbackRecord {
  return {
    id: row.id,
    clickId: row.click_id,
    orderId: row.order_id,
    status: row.status,
    amount: row.amount,
    reportedAt: row.reported_at,
  };
}

export function mapClaim(row: Tables<"claims">): Claim {
  return {
    id: row.id,
    userId: row.user_id,
    rawText: row.raw_text,
    submittedAt: row.submitted_at,
    claimedOrderValue: row.claimed_order_value,
    claimedRetailerId: row.claimed_retailer_id,
    claimedOrderDate: row.claimed_order_date,
    status: row.status,
    diagnosisCode: row.diagnosis_code,
    confidence: row.confidence,
    resolutionText: row.resolution_text,
    clarifyingQuestion: row.clarifying_question,
    clarifyingAnswer: row.clarifying_answer,
    escalationPacket: null,
    resolvedAt: row.resolved_at,
  };
}
