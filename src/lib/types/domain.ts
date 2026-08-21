export const DIAGNOSIS_CODES = [
  "WITHIN_TRACKING_SLA",
  "PENDING_CONFIRMATION_WINDOW",
  "ORDER_CANCELLED_OR_RETURNED",
  "EXCLUDED_CATEGORY",
  "NO_CLICK_RECORDED",
  "REFERRER_STRIPPED",
  "NATIVE_APP_HANDOFF",
  "COUPON_ATTRIBUTION_LOSS",
  "SESSION_EXPIRED",
  "CART_PRELOADED",
  "ACCOUNT_MISMATCH",
  "GENUINE_TRACKING_FAILURE",
  "INSUFFICIENT_EVIDENCE",
] as const;

export type DiagnosisCode = (typeof DIAGNOSIS_CODES)[number];

export type UserTier = "standard" | "gold";
export type Device = "android_app" | "ios_app" | "mweb" | "desktop";
export type OrderStatus =
  | "placed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";
export type CashbackStatus =
  | "untracked"
  | "pending"
  | "confirmed"
  | "cancelled";
export type ClaimStatus =
  | "submitted"
  | "needs_input"
  | "resolved"
  | "escalated"
  | "closed";

export type Disposition =
  | "auto_resolve"
  | "needs_input"
  | "escalate_network"
  | "escalate_human";

export interface User {
  id: string;
  email: string;
  name: string;
  signupDate: string;
  lifetimeCashback: number;
  tier: UserTier;
}

export interface Retailer {
  id: string;
  name: string;
  trackingSlaHours: number;
  confirmationWindowDays: number;
  excludedCategories: string[];
  allowsCouponStacking: boolean;
  allowsCartPreloading: boolean;
  knownDeeplinkIssue: boolean;
  termsUrl: string;
}

export interface Click {
  id: string;
  userId: string;
  retailerId: string;
  clickedAt: string;
  clickId: string;
  device: Device;
  handoffToNativeApp: boolean;
  referrerIntact: boolean;
  cartPreloaded: boolean;
}

export interface Order {
  id: string;
  userId: string;
  retailerId: string;
  orderedAt: string;
  orderValue: number;
  category: string;
  status: OrderStatus;
  couponCodeUsed: string | null;
  emailUsed: string;
}

export interface CashbackRecord {
  id: string;
  clickId: string | null;
  orderId: string | null;
  status: CashbackStatus;
  amount: number;
  reportedAt: string | null;
}

export interface EscalationPacket {
  caseId: string;
  retailer: string;
  clickId: string;
  orderedAt: string;
  orderValue: number;
  evidenceSummary: string[];
  requestedAction: string;
}

export interface Claim {
  id: string;
  userId: string;
  rawText: string;
  submittedAt: string;
  claimedOrderValue: number | null;
  claimedRetailerId: string | null;
  claimedOrderDate: string | null;
  status: ClaimStatus;
  diagnosisCode: DiagnosisCode | null;
  confidence: number | null;
  resolutionText: string | null;
  clarifyingQuestion: string | null;
  clarifyingAnswer: string | null;
  escalationPacket: EscalationPacket | null;
  resolvedAt: string | null;
}

export interface ClaimContext {
  now: string;
  claim: Claim;
  user: User;
  retailer: Retailer | null;
  clicks: Click[];
  orders: Order[];
  cashbackRecords: CashbackRecord[];
  platformCouponCodes: string[];
  goodwillCreditsInLast90Days: number;
}

export type Rule = {
  code: DiagnosisCode;
  test: (ctx: ClaimContext) => boolean;
  confidence: (ctx: ClaimContext) => number;
  disposition: Disposition;
  goodwillEligible: boolean;
  explain: (ctx: ClaimContext) => string;
  /**
   * One line naming the evidence this rule's test just read, phrased so it
   * reads correctly whether the test matched or not.
   */
  reason: (ctx: ClaimContext) => string;
};
