import type {
  CashbackRecord,
  Claim,
  ClaimContext,
  Click,
  Order,
  Retailer,
  User,
} from "@/lib/types/domain";

export const FIXED_NOW = "2026-08-20T12:00:00.000Z";

type FixtureOptions = {
  now?: string;
  claim?: Partial<Claim>;
  user?: Partial<User>;
  retailer?: Partial<Retailer> | null;
  order?: Partial<Order> | null;
  orders?: Order[];
  click?: Partial<Click> | null;
  clicks?: Click[];
  cashbackRecord?: Partial<CashbackRecord> | null;
  cashbackRecords?: CashbackRecord[];
  platformCouponCodes?: string[];
  goodwillCreditsInLast90Days?: number;
};

export function makeContext(options: FixtureOptions = {}): ClaimContext {
  const user: User = {
    id: "user-1",
    email: "person@example.test",
    name: "Test Person",
    signupDate: "2025-01-01T00:00:00.000Z",
    lifetimeCashback: 2_400,
    tier: "standard",
    ...options.user,
  };
  const retailer: Retailer | null =
    options.retailer === null
      ? null
      : {
          id: "retailer-1",
          name: "Nimbus Mart",
          trackingSlaHours: 24,
          confirmationWindowDays: 30,
          excludedCategories: ["Gift cards"],
          allowsCouponStacking: false,
          allowsCartPreloading: false,
          knownDeeplinkIssue: false,
          termsUrl: "https://example.com/nimbus/terms",
          ...options.retailer,
        };
  const order: Order | null =
    options.order === null
      ? null
      : {
          id: "order-1",
          userId: user.id,
          retailerId: retailer?.id ?? "retailer-1",
          orderedAt: "2026-08-15T12:00:00.000Z",
          orderValue: 1_000,
          category: "Home",
          status: "delivered",
          couponCodeUsed: null,
          emailUsed: user.email,
          ...options.order,
        };
  const click: Click | null =
    options.click === null
      ? null
      : {
          id: "click-row-1",
          userId: user.id,
          retailerId: retailer?.id ?? "retailer-1",
          clickedAt: order
            ? new Date(
                new Date(order.orderedAt).getTime() - 30 * 60 * 1000,
              ).toISOString()
            : "2026-08-15T11:30:00.000Z",
          clickId: "clk_external_1",
          device: "desktop",
          handoffToNativeApp: false,
          referrerIntact: true,
          cartPreloaded: false,
          ...options.click,
        };
  const cashbackRecord: CashbackRecord | null =
    options.cashbackRecord === null || options.cashbackRecord === undefined
      ? null
      : {
          id: "cashback-1",
          clickId: click?.id ?? null,
          orderId: order?.id ?? null,
          status: "pending",
          amount: 30,
          reportedAt: "2026-08-15T14:00:00.000Z",
          ...options.cashbackRecord,
        };
  const claim: Claim = {
    id: "claim-12345678",
    userId: user.id,
    rawText: "My cashback did not track.",
    submittedAt: "2026-08-20T11:00:00.000Z",
    claimedOrderValue: order?.orderValue ?? 1_000,
    claimedRetailerId: retailer?.id ?? "retailer-1",
    claimedOrderDate: order?.orderedAt ?? "2026-08-15T12:00:00.000Z",
    status: "submitted",
    diagnosisCode: null,
    confidence: null,
    resolutionText: null,
    clarifyingQuestion: null,
    clarifyingAnswer: null,
    escalationPacket: null,
    resolvedAt: null,
    ...options.claim,
  };

  return {
    now: options.now ?? FIXED_NOW,
    claim,
    user,
    retailer,
    orders: options.orders ?? (order ? [order] : []),
    clicks: options.clicks ?? (click ? [click] : []),
    cashbackRecords:
      options.cashbackRecords ?? (cashbackRecord ? [cashbackRecord] : []),
    platformCouponCodes: options.platformCouponCodes ?? ["NIMBUS10"],
    goodwillCreditsInLast90Days:
      options.goodwillCreditsInLast90Days ?? 0,
  };
}
