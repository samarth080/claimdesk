import type { Json } from "@/lib/types/database";
import type { ClaimContext, DiagnosisCode } from "@/lib/types/domain";
import { getDemoScenario, resolveDemoClaimDate } from "@/lib/demo/scenarios";
import { parseClaimAtIntake } from "@/lib/ai/parser";
import { buildResolutionMessage } from "@/lib/claims/message";
import { buildReasoningView } from "@/lib/reasoning/view";
import { writeResolutionCopy } from "@/lib/ai/resolution";
import {
  diagnoseClaim,
  matchOrder,
  selectClarifyingQuestionForDiagnosis,
} from "@/lib/rules";
import { createServerClient } from "@/lib/supabase/server";

import {
  mapCashbackRecord,
  mapClaim,
  mapClick,
  mapOrder,
  mapRetailer,
  mapUser,
} from "./mappers";
import type {
  ClaimIntakePayload,
  ClaimIntakeResponse,
  IntakeOutcome,
} from "./types";

const DEMO_USER_EMAIL = "aarav.mehta@example.test";
const MINIMUM_CLAIM_LENGTH = 12;
const MAXIMUM_CLAIM_LENGTH = 1_500;

function outcomeForDisposition(
  disposition: ReturnType<typeof diagnoseClaim>["disposition"],
): IntakeOutcome {
  if (disposition === "auto_resolve") return "resolved";
  if (disposition === "needs_input") return "needs_input";
  return "escalated";
}

function titleFor(
  outcome: IntakeOutcome,
  code: DiagnosisCode,
): string {
  if (outcome === "resolved") return "We found the answer";
  if (outcome === "needs_input") return "One detail will unlock this";
  if (code === "GENUINE_TRACKING_FAILURE") {
    return "This needs a real tracking claim";
  }
  return "A specialist will review this";
}

export async function submitClaimForDiagnosis(
  payload: ClaimIntakePayload,
): Promise<ClaimIntakeResponse> {
  const rawText = payload.rawText.trim();
  if (rawText.length < MINIMUM_CLAIM_LENGTH) {
    return {
      success: false,
      kind: "error",
      error: "Add a little more detail, such as the retailer, order date or amount.",
    };
  }
  if (rawText.length > MAXIMUM_CLAIM_LENGTH) {
    return {
      success: false,
      kind: "error",
      error: `Keep the description under ${MAXIMUM_CLAIM_LENGTH.toLocaleString("en-IN")} characters.`,
    };
  }

  try {
    const supabase = createServerClient();
    const demoScenario = payload.demoScenarioKey
      ? getDemoScenario(payload.demoScenarioKey)
      : null;
    const intakeUserEmail = demoScenario?.userEmail ?? DEMO_USER_EMAIL;
    const [userResult, retailerResult] = await Promise.all([
      supabase.from("users").select("*").eq("email", intakeUserEmail).single(),
      supabase.from("retailers").select("*").order("name"),
    ]);
    if (userResult.error || !userResult.data) {
      throw new Error("Synthetic current user is unavailable.");
    }
    if (retailerResult.error || !retailerResult.data) {
      throw new Error("Retailer reference data is unavailable.");
    }

    const user = mapUser(userResult.data);
    const retailers = retailerResult.data.map(mapRetailer);
    const now = new Date();
    const demoRetailer = demoScenario
      ? retailers.find((retailer) => retailer.name === demoScenario.retailerName) ?? null
      : null;
    const demoAnchorRetailer = demoScenario
      ? retailers.find(
          (retailer) =>
            retailer.name ===
            (demoScenario.actualRetailerName ?? demoScenario.retailerName),
        ) ?? null
      : null;
    const demoOrders = demoScenario
      ? ((await supabase.from("orders").select("*").eq("user_id", user.id)).data ??
          []).map(mapOrder)
      : [];
    const parsed = demoScenario
      ? {
          status: "parsed" as const,
          source: "demo" as const,
          retailer: demoRetailer,
          approximateOrderDate:
            demoScenario.key === "vague"
              ? null
              : resolveDemoClaimDate(
                  demoScenario,
                  demoOrders,
                  demoAnchorRetailer?.id ?? null,
                  now,
                ),
          approximateOrderValue: demoScenario.approximateValue,
          volunteeredSignals: null,
        }
      : await parseClaimAtIntake({
          rawText,
          retailers,
          now,
          manualDetails: payload.manualDetails,
        });
    if (parsed.status === "manual_required") {
      return {
        success: false,
        kind: "manual_entry_required",
        error: parsed.reason,
        retailerOptions: retailers.map(({ id, name }) => ({ id, name })),
      };
    }
    const insertResult = await supabase
      .from("claims")
      .insert({
        user_id: user.id,
        raw_text: rawText,
        submitted_at: now.toISOString(),
        claimed_order_value: parsed.approximateOrderValue,
        claimed_retailer_id: parsed.retailer?.id ?? null,
        claimed_order_date: parsed.approximateOrderDate,
        status: "submitted",
      })
      .select("*")
      .single();
    if (insertResult.error || !insertResult.data) {
      throw new Error("Claim could not be created.");
    }

    const claim = mapClaim(insertResult.data);
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
    const evidenceError = [
      clicksResult.error,
      ordersResult.error,
      cashbackResult.error,
      couponsResult.error,
      goodwillResult.error,
    ].find(Boolean);
    if (evidenceError) throw new Error("Evidence could not be loaded.");

    const clicks = (clicksResult.data ?? []).map(mapClick);
    const orders = (ordersResult.data ?? []).map(mapOrder);
    const cashbackRecords = (cashbackResult.data ?? []).map(mapCashbackRecord);
    const preliminaryContext: ClaimContext = {
      now: now.toISOString(),
      claim,
      user,
      retailer: parsed.retailer,
      clicks,
      orders,
      cashbackRecords,
      platformCouponCodes: [],
      goodwillCreditsInLast90Days: goodwillResult.count ?? 0,
    };
    const matchedOrder = matchOrder(preliminaryContext);
    const retailer =
      parsed.retailer ??
      retailers.find((candidate) => candidate.id === matchedOrder?.retailerId) ??
      null;
    const platformCouponCodes = (couponsResult.data ?? [])
      .filter(
        (coupon) => coupon.active && coupon.retailer_id === retailer?.id,
      )
      .map((coupon) => coupon.code);
    const context: ClaimContext = {
      ...preliminaryContext,
      retailer,
      platformCouponCodes,
    };
    const diagnosis = diagnoseClaim(context);
    const outcome = outcomeForDisposition(diagnosis.disposition);
    const clarifyingQuestion = selectClarifyingQuestionForDiagnosis(
      diagnosis.code,
    );
    const caseId =
      diagnosis.escalationPacket?.caseId ??
      (diagnosis.disposition === "escalate_human"
        ? `HUM-${claim.id.slice(0, 8).toUpperCase()}`
        : null);
    const eta =
      diagnosis.disposition === "escalate_network"
        ? "Affiliate-network response target: within 7 working days."
        : diagnosis.disposition === "escalate_human"
          ? "Human review target: within 2 working days."
          : null;
    const fallbackMessage = buildResolutionMessage(diagnosis);
    const resolution = await writeResolutionCopy({
      diagnosis,
      fallback: fallbackMessage,
      evidence: {
        retailer: retailer?.name ?? null,
        claimed_order_value: claim.claimedOrderValue,
        claimed_order_date: claim.claimedOrderDate,
        order_status: matchedOrder?.status ?? null,
        tracking_sla_hours: retailer?.trackingSlaHours ?? null,
        confidence_percent: Math.round(diagnosis.confidence * 100),
        goodwill_auto_approved: diagnosis.goodwill?.approved ?? false,
        volunteered_coupon_mentioned:
          parsed.volunteeredSignals?.couponMentioned ?? null,
        volunteered_channel: parsed.volunteeredSignals?.channel ?? null,
        volunteered_cancelled_or_returned:
          parsed.volunteeredSignals?.cancelledOrReturned ?? null,
      },
    });
    const escalationPacket =
      diagnosis.escalationPacket ??
      (diagnosis.disposition === "escalate_human" && diagnosis.goodwill
        ? {
            caseId,
            diagnosisCode: diagnosis.code,
            retailer: retailer?.name ?? "Retailer not yet matched",
            recommendation: diagnosis.goodwill.recommendation,
            policyChecks: diagnosis.goodwill.checks,
            requestedAction:
              "Review the failed goodwill-policy checks and decide whether to make an exception.",
          }
        : null);
    const updateResult = await supabase
      .from("claims")
      .update({
        status:
          outcome === "resolved"
            ? "resolved"
            : outcome === "needs_input"
              ? "needs_input"
              : "escalated",
        diagnosis_code: diagnosis.code,
        confidence: diagnosis.confidence,
        resolution_text: resolution.message,
        clarifying_question: clarifyingQuestion?.text ?? null,
        escalation_packet: escalationPacket as Json,
        resolved_at: outcome === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", claim.id);
    if (updateResult.error) throw new Error("Claim outcome could not be saved.");

    return {
      success: true,
      claimId: claim.id,
      caseId,
      outcome,
      code: diagnosis.code,
      confidence: diagnosis.confidence,
      title: titleFor(outcome, diagnosis.code),
      message: resolution.message,
      clarifyingQuestion,
      clarificationApplied: false,
      reasoning: buildReasoningView(diagnosis),
      eta,
      goodwill: diagnosis.goodwill
        ? {
            approved: diagnosis.goodwill.approved,
            recommendation: diagnosis.goodwill.recommendation,
            checks: diagnosis.goodwill.checks,
          }
        : null,
      parserSource: parsed.source,
      copySource: resolution.source,
    };
  } catch {
    return {
      success: false,
      kind: "error",
      error: "We could not check this claim just now. Please try again.",
    };
  }
}
