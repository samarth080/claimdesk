import { formatIndiaDate, formatIndiaDateTime, formatRupees } from "@/lib/rules/dates";
import type { MatchedEvidence } from "@/lib/rules/evidence";
import type { ClaimContext, DiagnosisCode, Order } from "@/lib/types/domain";

import type { DemoScenarioKey } from "./scenarios";

export type ArtifactKind =
  | "order_email"
  | "retailer_terms"
  | "session_log"
  | "referral_header";

export type ArtifactField = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export type CaseArtifact = {
  id: string;
  kind: ArtifactKind;
  title: string;
  source: string;
  meta: string;
  /** Evidence fields this document is the upstream source of. */
  corroborates: string[];
  /** The rule whose test read those fields. */
  citedBy: DiagnosisCode;
  /** The specific line the decision rests on. */
  citation: string;
  fields?: ArtifactField[];
  log?: string[];
};

export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  order_email: "Order email",
  retailer_terms: "Retailer terms",
  session_log: "Session log",
  referral_header: "Referral headers",
};

type ArtifactInput = {
  context: ClaimContext;
  evidence: MatchedEvidence;
  /** The order a messy claim nearly matched, when nothing matched at all. */
  nearMiss: Order | null;
  retailerNames: Record<string, string>;
};

function orderRef(order: Order): string {
  return `ORD-${order.id.slice(0, 8).toUpperCase()}`;
}

type Builder = (input: ArtifactInput) => CaseArtifact[];

const BUILDERS: Partial<Record<DemoScenarioKey, Builder>> = {
  returned_it: ({ context, evidence }) => {
    const order = evidence.order;
    if (!order) return [];

    return [
      {
        id: "return-confirmation",
        kind: "order_email",
        title: "Return accepted",
        source: `${context.retailer?.name ?? "Retailer"} · sent to ${order.emailUsed}`,
        meta: `Order placed ${formatIndiaDate(order.orderedAt)}`,
        corroborates: ["status", "order_value"],
        citedBy: "ORDER_CANCELLED_OR_RETURNED",
        citation: `Status line reads "Returned", which is the value the order record carries.`,
        fields: [
          { label: "Order reference", value: orderRef(order) },
          { label: "Order value", value: formatRupees(order.orderValue) },
          { label: "Status", value: "Returned — refund issued", emphasis: true },
          { label: "Category", value: order.category },
        ],
      },
    ];
  },

  gift_card: ({ context, evidence }) => {
    const retailer = context.retailer;
    const order = evidence.order;
    if (!retailer) return [];

    return [
      {
        id: "cashback-terms",
        kind: "retailer_terms",
        title: `${retailer.name} cashback terms, clause 4.2`,
        source: retailer.termsUrl,
        meta: "Excluded categories",
        corroborates: ["excluded_categories", "category"],
        citedBy: "EXCLUDED_CATEGORY",
        citation: `"${order?.category ?? "Gift cards"}" appears in the excluded list, and the matched order sits in that category.`,
        fields: [
          {
            label: "4.2 (a)",
            value: `No cashback is payable on ${retailer.excludedCategories.join(" or ")}.`,
            emphasis: true,
          },
          {
            label: "4.2 (b)",
            value: `Cashback is confirmed within ${retailer.confirmationWindowDays} days of delivery.`,
          },
          {
            label: "4.2 (c)",
            value: `Transactions must be tracked within ${retailer.trackingSlaHours} hours of the referral click.`,
          },
        ],
      },
    ];
  },

  app_handoff: ({ context, evidence }) => {
    const click = evidence.click;
    if (!click) return [];

    return [
      {
        id: "handoff-session",
        kind: "session_log",
        title: "Deep-link handoff",
        source: `Client session · ${click.clickId}`,
        meta: formatIndiaDateTime(click.clickedAt),
        corroborates: ["handoff_to_native_app", "known_deeplink_issue"],
        citedBy: "NATIVE_APP_HANDOFF",
        citation:
          "The handoff line shows the tracking parameters were dropped when the retailer app took over.",
        log: [
          `[00.000] tap  cashback app → offer ${context.retailer?.name ?? "retailer"}`,
          `[00.104] GET  /out?clk=${click.clickId}&sub=cd_app`,
          `[00.212] 302  → ${(context.retailer?.name ?? "retailer").toLowerCase().replace(/[^a-z]/g, "")}://product?id=91142`,
          `[00.213] WARN universal link claimed by native app; query string not forwarded`,
          `[00.480] app  native app foreground, no referral parameters present`,
          `[06:41m] app  checkout completed inside native app`,
        ],
      },
    ];
  },

  coupon_detour: ({ context, evidence }) => {
    const order = evidence.order;
    if (!order) return [];

    return [
      {
        id: "referral-chain",
        kind: "referral_header",
        title: "Referral header at checkout",
        source: `${context.retailer?.name ?? "Retailer"} · last-click attribution`,
        meta: formatIndiaDateTime(order.orderedAt),
        corroborates: ["coupon_code_used", "allows_coupon_stacking"],
        citedBy: "COUPON_ATTRIBUTION_LOSS",
        citation: `The final Referer is the coupon site, and ${order.couponCodeUsed ?? "the code"} is not in the platform coupon set.`,
        log: [
          `Referer: https://cashback.example/out?clk=…      (t-41m)`,
          `Referer: https://couponstack.example/nimbus-deals  (t-3m)`,
          `X-Applied-Coupon: ${order.couponCodeUsed ?? "UNKNOWN"}`,
          `X-Coupon-Source: couponstack.example`,
          `X-Attribution-Window: last-click`,
          `X-Attributed-To: couponstack.example`,
        ],
      },
    ];
  },

  ghost_click: ({ context, evidence }) => {
    const order = evidence.order;
    if (!order) return [];

    return [
      {
        id: "blocked-session",
        kind: "session_log",
        title: "Tracking request blocked",
        source: "Client session · privacy extension active",
        meta: formatIndiaDateTime(order.orderedAt),
        corroborates: ["click_record", "pre_order_click_count"],
        citedBy: "NO_CLICK_RECORDED",
        citation:
          "The redirect never reached the tracking host, which is why no click row exists to read.",
        log: [
          `[00.000] tap  cashback offer ${context.retailer?.name ?? "retailer"}`,
          `[00.031] GET  https://track.cashback.example/out?clk=…`,
          `[00.032] BLOCKED by content blocker rule "affiliate-trackers"`,
          `[00.033] navigation continued to retailer without referral`,
          `[00.900] doc  retailer landing page, document.referrer = ""`,
        ],
      },
      {
        id: "order-confirmation",
        kind: "order_email",
        title: "Order confirmed",
        source: `${context.retailer?.name ?? "Retailer"} · sent to ${order.emailUsed}`,
        meta: formatIndiaDateTime(order.orderedAt),
        corroborates: ["order_record", "order_value"],
        citedBy: "NO_CLICK_RECORDED",
        citation:
          "The order itself is not in doubt; it is the referral that is missing.",
        fields: [
          { label: "Order reference", value: orderRef(order) },
          { label: "Order value", value: formatRupees(order.orderValue) },
          { label: "Category", value: order.category },
          { label: "Status", value: order.status },
        ],
      },
    ];
  },

  real_failure: ({ context, evidence }) => {
    const { click, order } = evidence;
    if (!click || !order) return [];

    return [
      {
        id: "clean-session",
        kind: "session_log",
        title: "Clean referral handoff",
        source: `Client session · ${click.clickId}`,
        meta: formatIndiaDateTime(click.clickedAt),
        corroborates: ["click_record", "referrer_intact"],
        citedBy: "GENUINE_TRACKING_FAILURE",
        citation:
          "Referral parameters survived to the retailer, so nothing on our side explains the miss.",
        log: [
          `[00.000] GET  /out?clk=${click.clickId}`,
          `[00.118] 302  → retailer landing page with referral intact`,
          `[00.402] doc  document.referrer = https://track.cashback.example/`,
          `[00.403] set  affiliate cookie written, expiry 30d`,
          `[00.404] OK   handoff complete, no parameters dropped`,
        ],
      },
      {
        id: "order-confirmation",
        kind: "order_email",
        title: "Order confirmed",
        source: `${context.retailer?.name ?? "Retailer"} · sent to ${order.emailUsed}`,
        meta: formatIndiaDateTime(order.orderedAt),
        corroborates: ["order_record", "ordered_at", "order_value"],
        citedBy: "GENUINE_TRACKING_FAILURE",
        citation:
          "The purchase completed and was delivered, so the network has a transaction to validate against.",
        fields: [
          { label: "Order reference", value: orderRef(order) },
          { label: "Order value", value: formatRupees(order.orderValue) },
          { label: "Placed", value: formatIndiaDateTime(order.orderedAt) },
          { label: "Status", value: order.status },
        ],
      },
    ];
  },

  wrong_date: ({ context, evidence }) => {
    const order = evidence.order;
    if (!order) return [];

    return [
      {
        id: "order-confirmation",
        kind: "order_email",
        title: "Order confirmed",
        source: `${context.retailer?.name ?? "Retailer"} · sent to ${order.emailUsed}`,
        meta: formatIndiaDateTime(order.orderedAt),
        corroborates: ["ordered_at", "order_value"],
        citedBy: "GENUINE_TRACKING_FAILURE",
        citation: `The email dates the order to ${formatIndiaDate(order.orderedAt)}, and the claim said ${formatIndiaDate(context.claim.claimedOrderDate ?? order.orderedAt)}. The gap is inside the matching tolerance.`,
        fields: [
          { label: "Order reference", value: orderRef(order) },
          {
            label: "Placed",
            value: formatIndiaDateTime(order.orderedAt),
            emphasis: true,
          },
          { label: "Order value", value: formatRupees(order.orderValue) },
          { label: "Status", value: order.status },
        ],
      },
    ];
  },

  wrong_retailer: ({ nearMiss, retailerNames }) => {
    if (!nearMiss) return [];

    return [
      {
        id: "order-confirmation",
        kind: "order_email",
        title: "Order confirmed",
        source: `${retailerNames[nearMiss.retailerId] ?? "Retailer"} · sent to ${nearMiss.emailUsed}`,
        meta: formatIndiaDateTime(nearMiss.orderedAt),
        corroborates: ["claimed_retailer_id", "order_record"],
        citedBy: "INSUFFICIENT_EVIDENCE",
        citation: `The order the shopper means was placed at ${retailerNames[nearMiss.retailerId] ?? "another retailer"}, not the retailer they named. The matcher will not cross that constraint on its own.`,
        fields: [
          { label: "Order reference", value: orderRef(nearMiss) },
          {
            label: "Retailer",
            value: retailerNames[nearMiss.retailerId] ?? nearMiss.retailerId,
            emphasis: true,
          },
          { label: "Order value", value: formatRupees(nearMiss.orderValue) },
          { label: "Placed", value: formatIndiaDateTime(nearMiss.orderedAt) },
        ],
      },
    ];
  },
};

export function buildCaseArtifacts(
  key: DemoScenarioKey,
  input: ArtifactInput,
): CaseArtifact[] {
  return BUILDERS[key]?.(input) ?? [];
}
