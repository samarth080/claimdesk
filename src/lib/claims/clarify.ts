import { buildResolutionMessage } from "@/lib/claims/message";
import { buildReasoningView } from "@/lib/reasoning/view";
import { writeResolutionCopy } from "@/lib/ai/resolution";
import {
  applyClarifyingAnswer,
  CLARIFYING_QUESTIONS,
  diagnoseClaim,
  isValidClarifyingAnswer,
  matchOrder,
  routeAfterClarification,
  selectClarifyingQuestionForDiagnosis,
} from "@/lib/rules";
import { createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";
import type { ClaimContext, DiagnosisCode } from "@/lib/types/domain";

import {
  mapCashbackRecord,
  mapClaim,
  mapClick,
  mapOrder,
  mapRetailer,
  mapUser,
} from "./mappers";
import type {
  ClarifyingAnswerPayload,
  ClaimIntakeResponse,
  IntakeOutcome,
} from "./types";

function outcomeFor(
  disposition: ReturnType<typeof diagnoseClaim>["disposition"],
): IntakeOutcome {
  if (disposition === "auto_resolve") return "resolved";
  if (disposition === "needs_input") return "needs_input";
  return "escalated";
}

function titleFor(outcome: IntakeOutcome, code: DiagnosisCode): string {
  if (outcome === "resolved") return "Diagnosis updated";
  if (outcome === "needs_input") return "One more detail will unlock this";
  if (code === "GENUINE_TRACKING_FAILURE") {
    return "This needs a real tracking claim";
  }
  return "Your answer is with a specialist";
}

export async function answerClaimClarification(
  payload: ClarifyingAnswerPayload,
): Promise<ClaimIntakeResponse> {
  if (!isValidClarifyingAnswer(payload.questionId, payload.answer)) {
    return {
      success: false,
      kind: "error",
      error:
        payload.questionId === "WHICH_EMAIL"
          ? "Enter the email address used for the order."
          : payload.questionId === "ORDER_DATE"
            ? "Choose a valid order date."
            : "Choose one of the available answers.",
    };
  }

  try {
    const supabase = createServerClient();
    const claimResult = await supabase
      .from("claims")
      .select("*")
      .eq("id", payload.claimId)
      .single();
    if (claimResult.error || !claimResult.data) {
      throw new Error("Claim is unavailable.");
    }
    const [userResult, retailerResult] = await Promise.all([
      supabase.from("users").select("*").eq("id", claimResult.data.user_id).single(),
      supabase.from("retailers").select("*").order("name"),
    ]);
    if (userResult.error || !userResult.data) {
      throw new Error("Synthetic current user is unavailable.");
    }
    if (retailerResult.error || !retailerResult.data) {
      throw new Error("Retailer reference data is unavailable.");
    }
    const user = mapUser(userResult.data);
    const storedClaim = mapClaim(claimResult.data);
    if (storedClaim.userId !== user.id || storedClaim.status !== "needs_input") {
      throw new Error("Claim is not awaiting clarification.");
    }
    const expectedQuestion = CLARIFYING_QUESTIONS.find(
      (question) => question.id === payload.questionId,
    );
    if (
      !expectedQuestion ||
      expectedQuestion.text !== storedClaim.clarifyingQuestion
    ) {
      throw new Error("Clarifying question does not match the saved claim.");
    }

    const retailers = retailerResult.data.map(mapRetailer);
    const now = new Date();
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

    const preliminaryContext: ClaimContext = {
      now: now.toISOString(),
      claim: storedClaim,
      user,
      retailer:
        retailers.find(
          (retailer) => retailer.id === storedClaim.claimedRetailerId,
        ) ?? null,
      clicks: (clicksResult.data ?? []).map(mapClick),
      orders: (ordersResult.data ?? []).map(mapOrder),
      cashbackRecords: (cashbackResult.data ?? []).map(mapCashbackRecord),
      platformCouponCodes: [],
      goodwillCreditsInLast90Days: goodwillResult.count ?? 0,
    };
    const answeredContext = applyClarifyingAnswer(
      preliminaryContext,
      payload.questionId,
      payload.answer,
    );
    const matchedOrder = matchOrder(answeredContext);
    const retailer =
      answeredContext.retailer ??
      retailers.find((candidate) => candidate.id === matchedOrder?.retailerId) ??
      null;
    const context: ClaimContext = {
      ...answeredContext,
      retailer,
      platformCouponCodes: (couponsResult.data ?? [])
        .filter(
          (coupon) => coupon.active && coupon.retailer_id === retailer?.id,
        )
        .map((coupon) => coupon.code),
    };
    const diagnosis = routeAfterClarification(
      context,
      diagnoseClaim(context),
      payload.questionId,
      payload.answer,
    );
    const outcome = outcomeFor(diagnosis.disposition);
    const clarifyingQuestion =
      diagnosis.disposition === "needs_input"
        ? selectClarifyingQuestionForDiagnosis(diagnosis.code)
        : null;
    const caseId =
      diagnosis.escalationPacket?.caseId ??
      (diagnosis.disposition === "escalate_human"
        ? `HUM-${storedClaim.id.slice(0, 8).toUpperCase()}`
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
        claimed_order_value: context.claim.claimedOrderValue,
        claimed_order_date: context.claim.claimedOrderDate,
        order_status: matchedOrder?.status ?? null,
        tracking_sla_hours: retailer?.trackingSlaHours ?? null,
        confidence_percent: Math.round(diagnosis.confidence * 100),
        clarifying_answer: payload.answer.trim(),
      },
    });
    const escalationPacket =
      diagnosis.escalationPacket ??
      (diagnosis.disposition === "escalate_human"
        ? {
            caseId,
            diagnosisCode: diagnosis.code,
            retailer: retailer?.name ?? "Retailer not yet matched",
            clarifyingQuestion: expectedQuestion.text,
            clarifyingAnswer: payload.answer.trim(),
            evidenceOrderId: matchedOrder?.id ?? null,
            evidenceOrderEmail: matchedOrder?.emailUsed ?? null,
            accountEmail: user.email,
            requestedAction:
              diagnosis.code === "ACCOUNT_MISMATCH"
                ? "Verify order ownership and attach the order to the correct cashback account."
                : "Manually match the order reference because one targeted clarification did not resolve the evidence gap.",
            ruleTrace: diagnosis.trace,
          }
        : null);

    const updateResult = await supabase
      .from("claims")
      .update({
        claimed_order_date: context.claim.claimedOrderDate,
        status:
          outcome === "resolved"
            ? "resolved"
            : outcome === "needs_input"
              ? "needs_input"
              : "escalated",
        diagnosis_code: diagnosis.code,
        confidence: diagnosis.confidence,
        resolution_text: resolution.message,
        clarifying_question:
          clarifyingQuestion?.text ?? storedClaim.clarifyingQuestion,
        clarifying_answer: payload.answer.trim(),
        escalation_packet: escalationPacket as Json,
        resolved_at: outcome === "resolved" ? now.toISOString() : null,
      })
      .eq("id", storedClaim.id)
      .eq("status", "needs_input");
    if (updateResult.error) throw new Error("Clarified outcome could not be saved.");

    return {
      success: true,
      claimId: storedClaim.id,
      caseId,
      outcome,
      code: diagnosis.code,
      confidence: diagnosis.confidence,
      title: titleFor(outcome, diagnosis.code),
      message: resolution.message,
      clarifyingQuestion,
      clarificationApplied: true,
      reasoning: buildReasoningView(diagnosis),
      eta,
      goodwill: diagnosis.goodwill
        ? {
            approved: diagnosis.goodwill.approved,
            recommendation: diagnosis.goodwill.recommendation,
            checks: diagnosis.goodwill.checks,
          }
        : null,
      parserSource: "stored_claim",
      copySource: resolution.source,
    };
  } catch {
    return {
      success: false,
      kind: "error",
      error: "We could not apply that answer just now. Please try again.",
    };
  }
}
