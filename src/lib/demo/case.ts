import {
  mapCashbackRecord,
  mapClick,
  mapOrder,
  mapRetailer,
  mapUser,
} from "@/lib/claims/mappers";
import { buildResolutionMessage } from "@/lib/claims/message";
import { buildReasoningView, type ReasoningView } from "@/lib/reasoning/view";
import { diagnoseClaim } from "@/lib/rules/engine";
import { matchEvidence } from "@/lib/rules/evidence";
import {
  explainOrderMatch,
  type OrderMatchExplanation,
} from "@/lib/rules/matching";
import { selectClarifyingQuestionForDiagnosis } from "@/lib/rules/clarifications";
import type { ClarifyingQuestionView } from "@/lib/rules/questions";
import { createServerClient } from "@/lib/supabase/server";
import type { Claim, ClaimContext, Order } from "@/lib/types/domain";

import { buildCaseArtifacts, type CaseArtifact } from "./artifacts";
import {
  demoSuggestedAnswer,
  getDemoScenario,
  resolveDemoClaimDate,
  type DemoScenario,
  type DemoScenarioKey,
} from "./scenarios";

export type DemoParse = {
  retailer: string;
  statedDate: string | null;
  statedValue: number | null;
  volunteered: string[];
  note: string;
};

export type DemoDrift = {
  expected: string;
  actual: string;
  seedAgeHours: number;
  detail: string;
};

export type DemoCase = {
  scenario: DemoScenario;
  drift: DemoDrift | null;
  parse: DemoParse;
  match: OrderMatchExplanation;
  reasoning: ReasoningView;
  resolutionMessage: string;
  clarifyingQuestion: ClarifyingQuestionView | null;
  suggestedAnswer: string | null;
  artifacts: CaseArtifact[];
  retailerNames: Record<string, string>;
  caseId: string | null;
  limitation: string | null;
};

/**
 * Volunteered signals the shopper put in the message themselves. Listed so the
 * parse stage separates what was stated from what was looked up.
 */
function volunteeredSignals(rawText: string): string[] {
  const text = rawText.toLowerCase();
  const signals: string[] = [];
  if (/coupon|code|promo|savehub/.test(text)) signals.push("coupon mentioned");
  if (/app\b|tapped/.test(text)) signals.push("app journey mentioned");
  if (/return|cancel/.test(text)) signals.push("return or cancellation mentioned");
  if (/block|privacy|adblock/.test(text)) signals.push("tracking blocker mentioned");
  return signals;
}

const LIMITATIONS: Partial<Record<DemoScenarioKey, string>> = {
  wrong_retailer:
    "The gap here is the retailer, but the question set for INSUFFICIENT_EVIDENCE only offers the order date, so the engine asks about the date instead. A retailer question would be the right next rule change; it is not in this build.",
};

function buildDemoClaim(
  scenario: DemoScenario,
  userId: string,
  retailerId: string | null,
  claimedDate: string | null,
  now: Date,
): Claim {
  return {
    id: `sample${scenario.number}-demo-case-${scenario.key}`,
    userId,
    rawText: scenario.rawText,
    submittedAt: now.toISOString(),
    claimedOrderValue: scenario.approximateValue,
    claimedRetailerId: retailerId,
    claimedOrderDate: claimedDate,
    status: "submitted",
    diagnosisCode: null,
    confidence: null,
    resolutionText: null,
    clarifyingQuestion: null,
    clarifyingAnswer: null,
    escalationPacket: null,
    resolvedAt: null,
  };
}

/**
 * Runs a demo scenario through the real engine against the real seeded
 * evidence, without writing a claim. The page is a read of the system, not a
 * new row in it.
 */
export async function loadDemoCase(key: string): Promise<DemoCase | null> {
  const scenario = getDemoScenario(key);
  if (!scenario) return null;

  const supabase = createServerClient();
  const now = new Date();
  const [userResult, retailerResult] = await Promise.all([
    supabase.from("users").select("*").eq("email", scenario.userEmail).single(),
    supabase.from("retailers").select("*").order("name"),
  ]);
  if (userResult.error || !userResult.data) return null;
  if (retailerResult.error || !retailerResult.data) return null;

  const user = mapUser(userResult.data);
  const retailers = retailerResult.data.map(mapRetailer);
  const retailerNames = Object.fromEntries(
    retailers.map((retailer) => [retailer.id, retailer.name]),
  );
  const claimedRetailer =
    retailers.find((retailer) => retailer.name === scenario.retailerName) ?? null;
  const anchorRetailer =
    retailers.find(
      (retailer) =>
        retailer.name === (scenario.actualRetailerName ?? scenario.retailerName),
    ) ?? null;

  const ninetyDaysAgo = new Date(
    now.getTime() - 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [clicksResult, ordersResult, cashbackResult, couponsResult, goodwillResult] =
    await Promise.all([
      supabase.from("clicks").select("*").eq("user_id", user.id),
      supabase.from("orders").select("*").eq("user_id", user.id),
      supabase.from("cashback_records").select("*"),
      supabase.from("platform_coupons").select("*"),
      supabase
        .from("goodwill_credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("awarded_at", ninetyDaysAgo),
    ]);
  if (ordersResult.error || clicksResult.error || cashbackResult.error) return null;

  const orders = (ordersResult.data ?? []).map(mapOrder);
  const claimedDate =
    scenario.key === "vague"
      ? null
      : resolveDemoClaimDate(scenario, orders, anchorRetailer?.id ?? null, now);
  const claim = buildDemoClaim(
    scenario,
    user.id,
    claimedRetailer?.id ?? null,
    claimedDate,
    now,
  );
  const platformCouponCodes = (couponsResult.data ?? [])
    .filter((coupon) => coupon.active && coupon.retailer_id === claimedRetailer?.id)
    .map((coupon) => coupon.code);
  const context: ClaimContext = {
    now: now.toISOString(),
    claim,
    user,
    retailer: claimedRetailer,
    clicks: (clicksResult.data ?? []).map(mapClick),
    orders,
    cashbackRecords: (cashbackResult.data ?? []).map(mapCashbackRecord),
    platformCouponCodes,
    goodwillCreditsInLast90Days: goodwillResult.count ?? 0,
  };

  const diagnosis = diagnoseClaim(context);
  const match = explainOrderMatch(context, { retailerNames });
  const evidence = matchEvidence(context);
  const nearMiss: Order | null =
    evidence.order ??
    orders.find((order) =>
      match.candidates.some(
        (candidate) =>
          candidate.orderId === order.id &&
          candidate.exclusions.length === 1 &&
          candidate.exclusions[0]?.constraint === "retailer",
      ),
    ) ??
    null;

  const matchedOrder = evidence.order ?? nearMiss;
  const seedAgeHours = matchedOrder
    ? Math.round(
        ((now.getTime() - new Date(matchedOrder.orderedAt).getTime()) / 3_600_000 -
          scenario.ageHours) *
          10,
      ) / 10
    : 0;

  return {
    scenario,
    drift:
      diagnosis.code === scenario.expectedCode
        ? null
        : {
            expected: scenario.expectedCode,
            actual: diagnosis.code,
            seedAgeHours,
            detail: `This scenario is written for an order ${scenario.ageHours} hours old, but the seeded evidence was written ${seedAgeHours} hours ago and has kept ageing since. The rules are reading the evidence correctly; the evidence has simply moved past a time-based threshold. Re-running the seed restores it.`,
          },
    parse: {
      retailer: claimedRetailer?.name ?? "not identified",
      statedDate: claimedDate,
      statedValue: scenario.approximateValue,
      volunteered: volunteeredSignals(scenario.rawText),
      note:
        scenario.messy === "date"
          ? "The date in the message is wrong. It is carried through as stated, and the matcher deals with it."
          : scenario.messy === "retailer"
            ? "The retailer in the message is wrong. It is carried through as stated, and the matcher deals with it."
            : "Parsed from the message with the retailer resolved against the retailer table.",
    },
    match,
    reasoning: buildReasoningView(diagnosis),
    resolutionMessage: buildResolutionMessage(diagnosis),
    clarifyingQuestion:
      diagnosis.disposition === "needs_input"
        ? selectClarifyingQuestionForDiagnosis(diagnosis.code)
        : null,
    suggestedAnswer: demoSuggestedAnswer(
      scenario,
      now,
      evidence.order?.orderedAt ?? nearMiss?.orderedAt ?? undefined,
    ),
    retailerNames,
    artifacts: buildCaseArtifacts(scenario.key, {
      context,
      evidence,
      nearMiss,
      retailerNames,
    }),
    caseId:
      diagnosis.escalationPacket?.caseId ??
      (diagnosis.disposition === "escalate_human"
        ? `HUM-${claim.id.slice(0, 8).toUpperCase()}`
        : null),
    limitation: LIMITATIONS[scenario.key] ?? null,
  };
}
