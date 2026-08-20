import type { DiagnosisResult } from "@/lib/rules/engine";
import type { ClaimContext, DiagnosisCode } from "@/lib/types/domain";

import {
  pickClarifyingQuestion,
  toClarifyingQuestionView,
  type ClarifyingQuestionId,
} from "./questions";
import { matchOrder } from "./evidence";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function applyClarifyingAnswer(
  ctx: ClaimContext,
  questionId: ClarifyingQuestionId,
  answer: string,
): ClaimContext {
  const cleanAnswer = answer.trim();
  const claimedOrderDate =
    questionId === "ORDER_DATE"
      ? new Date(`${cleanAnswer}T12:00:00+05:30`).toISOString()
      : ctx.claim.claimedOrderDate;

  return {
    ...ctx,
    claim: {
      ...ctx.claim,
      claimedOrderDate,
      clarifyingAnswer: cleanAnswer,
    },
  };
}

export function isValidClarifyingAnswer(
  questionId: ClarifyingQuestionId,
  answer: string,
): boolean {
  const cleanAnswer = answer.trim();
  if (!cleanAnswer) return false;

  if (questionId === "ORDER_DATE") {
    if (!DATE_ONLY_PATTERN.test(cleanAnswer)) return false;
    return !Number.isNaN(
      new Date(`${cleanAnswer}T12:00:00+05:30`).getTime(),
    );
  }

  if (questionId === "WHICH_EMAIL") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanAnswer);
  }

  return cleanAnswer.length <= 160;
}

export function routeAfterClarification(
  ctx: ClaimContext,
  diagnosis: DiagnosisResult,
  questionId: ClarifyingQuestionId,
  answer: string,
): DiagnosisResult {
  if (
    questionId === "ORDER_DATE" &&
    diagnosis.code === "INSUFFICIENT_EVIDENCE"
  ) {
    return {
      ...diagnosis,
      disposition: "escalate_human",
      explanation: `Thanks for adding the order date ${answer.trim()}. We still could not match a click or order within the 36-hour evidence window, so a specialist will check the reference details manually instead of asking you another question.`,
    };
  }

  if (questionId !== "WHICH_EMAIL" || diagnosis.code !== "ACCOUNT_MISMATCH") {
    return diagnosis;
  }

  const order = matchOrder(ctx);
  const orderValue = order?.orderValue ?? ctx.claim.claimedOrderValue ?? 0;
  const confirmedEmail = answer.trim().toLowerCase();
  const evidenceEmail = order?.emailUsed.toLowerCase() ?? null;
  const confirmationMatchesEvidence = evidenceEmail === confirmedEmail;
  const explanation = confirmationMatchesEvidence
    ? `Thanks for confirming the email. The ₹${orderValue.toLocaleString("en-IN")} order used ${answer.trim()}, while this cashback account uses ${ctx.user.email}. A specialist needs to verify ownership and attach the order to the right account before any tracking claim is filed.`
    : `The email supplied does not match the email recorded on the ₹${orderValue.toLocaleString("en-IN")} order or this cashback account. A specialist will verify the order details before any tracking claim is filed.`;

  return {
    ...diagnosis,
    disposition: "escalate_human",
    explanation,
  };
}

function clarificationLiveCodes(code: DiagnosisCode): DiagnosisCode[] {
  if (code === "ACCOUNT_MISMATCH") {
    return ["ACCOUNT_MISMATCH", "GENUINE_TRACKING_FAILURE"];
  }
  if (code === "INSUFFICIENT_EVIDENCE") {
    return ["INSUFFICIENT_EVIDENCE", "GENUINE_TRACKING_FAILURE"];
  }
  return [code];
}

export function selectClarifyingQuestionForDiagnosis(code: DiagnosisCode) {
  const liveCodes = clarificationLiveCodes(code);
  const unknowns =
    code === "ACCOUNT_MISMATCH"
      ? (["order_email"] as const)
      : code === "INSUFFICIENT_EVIDENCE"
        ? (["order_date"] as const)
        : [];
  const question = pickClarifyingQuestion({
    liveCodes,
    unknowns: [...unknowns],
  });

  return question ? toClarifyingQuestionView(question, liveCodes.length) : null;
}
