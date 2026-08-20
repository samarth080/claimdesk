"use server";

import { submitClaimForDiagnosis } from "@/lib/claims/intake";
import { answerClaimClarification } from "@/lib/claims/clarify";
import type {
  ClarifyingAnswerPayload,
  ClaimIntakePayload,
  ClaimIntakeResponse,
} from "@/lib/claims/types";

export async function diagnoseCashbackClaim(
  payload: ClaimIntakePayload,
): Promise<ClaimIntakeResponse> {
  return submitClaimForDiagnosis(payload);
}

export async function answerCashbackClarification(
  payload: ClarifyingAnswerPayload,
): Promise<ClaimIntakeResponse> {
  return answerClaimClarification(payload);
}
