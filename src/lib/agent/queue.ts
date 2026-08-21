import type { Json } from "@/lib/types/database";
import type {
  CashbackRecord,
  ClaimContext,
  Click,
  DiagnosisCode,
  Order,
} from "@/lib/types/domain";
import { routeAfterClarification } from "@/lib/rules/clarifications";
import { formatIndiaDateTime, formatRupees } from "@/lib/rules/dates";
import { diagnoseClaim, type DiagnosisResult } from "@/lib/rules/engine";
import { matchEvidence, matchOrder } from "@/lib/rules/evidence";
import { readEvidence } from "@/lib/rules/reading";
import { buildReasoningView } from "@/lib/reasoning/view";
import { CLARIFYING_QUESTIONS } from "@/lib/rules/questions";
import { RULES } from "@/lib/rules/rules";
import { createServerClient } from "@/lib/supabase/server";

import {
  mapCashbackRecord,
  mapClaim,
  mapClick,
  mapOrder,
  mapRetailer,
  mapUser,
} from "@/lib/claims/mappers";

import type {
  AgentCasePacket,
  AgentClaimView,
  AgentQueueData,
} from "./types";


function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function jsonRecord(value: Json | null): Record<string, Json | undefined> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value;
}

function jsonString(
  record: Record<string, Json | undefined> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function jsonStringArray(
  record: Record<string, Json | undefined> | null,
  key: string,
): string[] {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function diagnoseForAgent(
  context: ClaimContext,
  storedCode: DiagnosisCode | null,
  storedConfidence: number | null,
): DiagnosisResult {
  try {
    return diagnoseClaim(context);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.startsWith("No diagnosis rule matched")
    ) {
      throw error;
    }

    const code = storedCode ?? "INSUFFICIENT_EVIDENCE";
    const rule = RULES.find((candidate) => candidate.code === code);
    return {
      code,
      confidence: storedConfidence ?? 0.5,
      disposition: "escalate_human",
      baseDisposition: rule?.disposition ?? "escalate_human",
      explanation:
        "This stored escalation could not be reproduced from the current evidence snapshot. Keep it with a human so the evidence drift can be checked instead of silently changing the outcome.",
      goodwill: null,
      escalationPacket: null,
      trace: RULES.map((candidate, index) => ({
        code: candidate.code,
        status: "skipped" as const,
        detail: "Current evidence test did not match.",
        order: index + 1,
        outcome: "not_matched" as const,
        reason: "Re-evaluated against the current snapshot; no match.",
      })),
      evidenceRead: readEvidence(context),
      action: {
        kind: "escalated_human" as const,
        detail:
          "Held with a specialist because the stored outcome could not be reproduced from the current evidence snapshot.",
      },
    };
  }
}

type PacketInput = {
  caseId: string;
  route: AgentCasePacket["route"];
  claimId: string;
  diagnosisCode: DiagnosisCode;
  confidence: number;
  claimantName: string;
  claimantEmail: string;
  retailerName: string;
  submittedAt: string;
  rawText: string;
  click: Click | null;
  order: Order | null;
  cashback: CashbackRecord | null;
  clarification: AgentClaimView["clarification"];
  storedPacket: Record<string, Json | undefined> | null;
};

export function buildAgentCasePacket(input: PacketInput): AgentCasePacket {
  const storedEvidence = jsonStringArray(input.storedPacket, "evidenceSummary");
  const evidenceSummary =
    storedEvidence.length > 0
      ? storedEvidence
      : [
          input.click
            ? `Click ${input.click.clickId} recorded with ${input.click.referrerIntact ? "intact" : "stripped"} referral data.`
            : "No matched click was found.",
          input.order
            ? `Order ${input.order.id} matched for ${formatRupees(input.order.orderValue)}.`
            : "No order could be matched.",
          input.cashback
            ? `Cashback record ${input.cashback.id} is ${input.cashback.status}.`
            : "No cashback record is linked to the click or order.",
        ];
  const requestedAction =
    jsonString(input.storedPacket, "requestedAction") ??
    (input.route === "Affiliate network"
      ? "Validate the transaction and create the missing cashback record."
      : "Verify the submitted evidence and complete the recommended manual review.");
  const identityFields = [
    { label: "Case ID", value: input.caseId },
    { label: "Claim ID", value: input.claimId },
    { label: "Claimant", value: input.claimantName },
    { label: "Account email", value: input.claimantEmail },
    { label: "Submitted", value: input.submittedAt },
  ];
  const transactionFields = [
    { label: "Retailer", value: input.retailerName },
    {
      label: "Click ID",
      value: input.click?.clickId ?? "No matched click",
    },
    {
      label: "Click recorded",
      value: input.click
        ? formatIndiaDateTime(input.click.clickedAt)
        : "No matched click",
    },
    {
      label: "Order ID",
      value: input.order?.id ?? "No matched order",
    },
    {
      label: "Order value",
      value: input.order ? formatRupees(input.order.orderValue) : "Not matched",
    },
    {
      label: "Order date",
      value: input.order ? formatIndiaDateTime(input.order.orderedAt) : "Not matched",
    },
    {
      label: "Order email",
      value: input.order?.emailUsed ?? "Not matched",
    },
    {
      label: "Cashback record",
      value: input.cashback
        ? `${input.cashback.id} · ${input.cashback.status}`
        : "None linked",
    },
    { label: "Diagnosis", value: input.diagnosisCode },
    {
      label: "Confidence",
      value: `${Math.round(input.confidence * 100)}%`,
    },
  ];
  const copyText = [
    `CLAIMDESK — ${input.route.toUpperCase()} CASE`,
    "",
    ...identityFields.map((field) => `${field.label}: ${field.value}`),
    "",
    ...transactionFields.map((field) => `${field.label}: ${field.value}`),
    "",
    `Customer statement: ${input.rawText}`,
    ...(input.clarification
      ? [
          `Clarifying question: ${input.clarification.question}`,
          `Clarifying answer: ${input.clarification.answer}`,
        ]
      : []),
    "",
    "Evidence:",
    ...evidenceSummary.map((line) => `- ${line}`),
    "",
    `Requested action: ${requestedAction}`,
  ].join("\n");

  return {
    heading:
      input.route === "Affiliate network"
        ? "Network claim draft"
        : "Human review brief",
    route: input.route,
    caseId: input.caseId,
    identityFields,
    transactionFields,
    evidenceSummary,
    requestedAction,
    copyText,
  };
}

export async function loadAgentQueue(): Promise<AgentQueueData> {
  const supabase = createServerClient();
  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [
    claimsResult,
    usersResult,
    retailersResult,
    clicksResult,
    ordersResult,
    cashbackResult,
    couponsResult,
    goodwillResult,
  ] = await Promise.all([
    supabase
      .from("claims")
      .select("*")
      .eq("status", "escalated")
      .order("submitted_at", { ascending: false }),
    supabase.from("users").select("*"),
    supabase.from("retailers").select("*"),
    supabase.from("clicks").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("cashback_records").select("*"),
    supabase.from("platform_coupons").select("*"),
    supabase
      .from("goodwill_credits")
      .select("user_id")
      .gte("awarded_at", ninetyDaysAgo),
  ]);
  const queryError = [
    claimsResult.error,
    usersResult.error,
    retailersResult.error,
    clicksResult.error,
    ordersResult.error,
    cashbackResult.error,
    couponsResult.error,
    goodwillResult.error,
  ].find(Boolean);
  if (queryError) throw new Error("Agent queue evidence could not be loaded.");

  const users = (usersResult.data ?? []).map(mapUser);
  const retailers = (retailersResult.data ?? []).map(mapRetailer);
  const clicks = (clicksResult.data ?? []).map(mapClick);
  const orders = (ordersResult.data ?? []).map(mapOrder);
  const cashbackRecords = (cashbackResult.data ?? []).map(mapCashbackRecord);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const retailersById = new Map(
    retailers.map((retailer) => [retailer.id, retailer]),
  );
  const clicksByUser = groupBy(clicks, (click) => click.userId);
  const ordersByUser = groupBy(orders, (order) => order.userId);
  const couponsByRetailer = groupBy(
    (couponsResult.data ?? []).filter((coupon) => coupon.active),
    (coupon) => coupon.retailer_id,
  );
  const goodwillByUser = new Map<string, number>();
  for (const credit of goodwillResult.data ?? []) {
    goodwillByUser.set(
      credit.user_id,
      (goodwillByUser.get(credit.user_id) ?? 0) + 1,
    );
  }

  const claims = (claimsResult.data ?? []).flatMap((claimRow) => {
    const claim = mapClaim(claimRow);
    const user = usersById.get(claim.userId);
    if (!user) return [];

    const userOrders = ordersByUser.get(user.id) ?? [];
    const initialRetailer = claim.claimedRetailerId
      ? retailersById.get(claim.claimedRetailerId) ?? null
      : null;
    const preliminaryContext: ClaimContext = {
      now: new Date().toISOString(),
      claim,
      user,
      retailer: initialRetailer,
      clicks: clicksByUser.get(user.id) ?? [],
      orders: userOrders,
      cashbackRecords,
      platformCouponCodes: [],
      goodwillCreditsInLast90Days: goodwillByUser.get(user.id) ?? 0,
    };
    const matchedOrder = matchOrder(preliminaryContext);
    const retailer =
      initialRetailer ??
      (matchedOrder ? retailersById.get(matchedOrder.retailerId) ?? null : null);
    const context: ClaimContext = {
      ...preliminaryContext,
      retailer,
      platformCouponCodes: retailer
        ? (couponsByRetailer.get(retailer.id) ?? []).map((coupon) => coupon.code)
        : [],
    };
    let diagnosis = diagnoseForAgent(
      context,
      claim.diagnosisCode,
      claim.confidence,
    );
    const answeredQuestion = CLARIFYING_QUESTIONS.find(
      (question) => question.text === claim.clarifyingQuestion,
    );
    if (answeredQuestion && claim.clarifyingAnswer) {
      diagnosis = routeAfterClarification(
        context,
        diagnosis,
        answeredQuestion.id,
        claim.clarifyingAnswer,
      );
    }
    const evidence = matchEvidence(context);
    const diagnosisCode = claim.diagnosisCode ?? diagnosis.code;
    const confidence = claim.confidence ?? diagnosis.confidence;
    const route =
      diagnosisCode === "GENUINE_TRACKING_FAILURE"
        ? "Affiliate network"
        : "Human specialist";
    const storedPacket = jsonRecord(claimRow.escalation_packet);
    const caseId =
      jsonString(storedPacket, "caseId") ??
      `${route === "Affiliate network" ? "NET" : "HUM"}-${claim.id.slice(0, 8).toUpperCase()}`;
    const submittedAt = formatIndiaDateTime(claim.submittedAt);
    const clarification =
      claim.clarifyingQuestion && claim.clarifyingAnswer
        ? {
            question: claim.clarifyingQuestion,
            answer: claim.clarifyingAnswer,
          }
        : null;
    const packet = buildAgentCasePacket({
      caseId,
      route,
      claimId: claim.id,
      diagnosisCode,
      confidence,
      claimantName: user.name,
      claimantEmail: user.email,
      retailerName: retailer?.name ?? "Retailer not matched",
      submittedAt,
      rawText: claim.rawText,
      click: evidence.click,
      order: evidence.order,
      cashback: evidence.cashbackRecord,
      clarification,
      storedPacket,
    });

    const view: AgentClaimView = {
      id: claim.id,
      caseId,
      submittedAt,
      diagnosisCode,
      confidence,
      route,
      claimantName: user.name,
      claimantEmail: user.email,
      claimantTier: user.tier,
      retailerName: retailer?.name ?? "Retailer not matched",
      claimedOrderValue: claim.claimedOrderValue,
      rawText: claim.rawText,
      diagnosisSummary: diagnosis.explanation,
      orderStatus: evidence.order?.status ?? null,
      reasoning: buildReasoningView(diagnosis),
      packet,
      clarification,
      goodwill:
        diagnosis.goodwill?.applicable || diagnosis.goodwill?.routeToHuman
          ? {
              recommendation: diagnosis.goodwill.recommendation,
              approved: diagnosis.goodwill.approved,
              checks: diagnosis.goodwill.checks,
            }
          : null,
    };
    return [view];
  });
  const network = claims.filter(
    (claim) => claim.route === "Affiliate network",
  ).length;
  const human = claims.length - network;
  const goodwillReviews = claims.filter((claim) => claim.goodwill).length;
  const averageConfidence =
    claims.length > 0
      ? claims.reduce((total, claim) => total + claim.confidence, 0) /
        claims.length
      : 0;

  return {
    claims,
    metrics: {
      total: claims.length,
      network,
      human,
      goodwillReviews,
      averageConfidence,
    },
  };
}
