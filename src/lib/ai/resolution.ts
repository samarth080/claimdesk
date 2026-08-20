import { z } from "zod";

import type { DiagnosisResult } from "@/lib/rules/engine";

import {
  getGroqTextGenerator,
  type TextGenerator,
} from "./groq";

const resolutionSchema = z.string().trim().min(20).max(700);
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u;
const GUARANTEE_PATTERN = /\b(guaranteed|definitely receive|promise(?:d)? cashback)\b/i;
const PROMISE_PATTERN =
  /\b(?:will|shall)\s+(?:be\s+)?(?:arrive|appear|approved|confirmed|credited|paid|processed|received)\b|\byou(?:'ll| will)\s+receive\b|\b(?:has|have|was|is)\s+(?:been\s+)?credited\b/i;
const WORKFLOW_PROMISE_PATTERN =
  /\b(?:this|it|resolution|review|claim)\s+(?:will|shall)\s+be\s+(?:completed|resolved|processed|finished)\b/i;
const DEADLINE_LANGUAGE_PATTERN = /\b(?:due by|within)\b/i;
const ESCALATION_DEADLINE_PATTERN =
  /\b(?:decision|response|update|review|case|claim|resolution)\b.{0,80}\b(?:by|within)\b/i;
const CONCRETE_VALUE_PATTERN = /\d/;
const TIMING_CODES = new Set([
  "WITHIN_TRACKING_SLA",
  "PENDING_CONFIRMATION_WINDOW",
]);

export type ResolutionCopySource = "ai" | "template_fallback";

export type ResolutionCopyResult = {
  message: string;
  source: ResolutionCopySource;
};

type WriteResolutionInput = {
  diagnosis: DiagnosisResult;
  fallback: string;
  evidence: Record<string, string | number | boolean | null>;
  generator?: TextGenerator | null;
};

const SYSTEM_PROMPT = `Write a missing-cashback resolution message in warm, specific, non-defensive language.
The deterministic rule engine has already decided the diagnosis. Never change, question or soften that diagnosis. Do not invent a deadline or promise when a review will finish.
Never blame the user. Include a concrete date or number from the supplied evidence. Never promise cashback that is not coming. Use "due by" for timing; never say it "will be credited", "will arrive" or "you will receive" it.
Use plain Indian English, no emoji, no heading and no markdown. Keep the complete response under 90 words.`;

function isAcceptableCopy(
  message: string,
  diagnosis: DiagnosisResult,
): boolean {
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  return (
    wordCount <= 90 &&
    CONCRETE_VALUE_PATTERN.test(message) &&
    !EMOJI_PATTERN.test(message) &&
    !GUARANTEE_PATTERN.test(message) &&
    !PROMISE_PATTERN.test(message) &&
    !WORKFLOW_PROMISE_PATTERN.test(message) &&
    !(
      !TIMING_CODES.has(diagnosis.code) &&
      DEADLINE_LANGUAGE_PATTERN.test(message)
    ) &&
    !(
      diagnosis.disposition !== "auto_resolve" &&
      ESCALATION_DEADLINE_PATTERN.test(message)
    )
  );
}

export async function writeResolutionCopy({
  diagnosis,
  fallback,
  evidence,
  generator = getGroqTextGenerator(),
}: WriteResolutionInput): Promise<ResolutionCopyResult> {
  if (!generator) return { message: fallback, source: "template_fallback" };

  try {
    const response = await generator({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({
        diagnosis_code: diagnosis.code,
        deterministic_explanation: fallback,
        disposition: diagnosis.disposition,
        evidence,
      }),
      maxTokens: 220,
    });
    const message = resolutionSchema.parse(response);
    if (!isAcceptableCopy(message, diagnosis)) {
      return { message: fallback, source: "template_fallback" };
    }
    return { message, source: "ai" };
  } catch {
    return { message: fallback, source: "template_fallback" };
  }
}
