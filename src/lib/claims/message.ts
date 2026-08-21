import type { DiagnosisResult } from "@/lib/rules/engine";

/**
 * The deterministic resolution message. Groq may polish this wording, but this
 * is the complete answer on its own and is what the demo case files show.
 */
export function buildResolutionMessage(result: DiagnosisResult): string {
  if (result.goodwill?.approved) {
    return `${result.explanation} All 3 goodwill-policy checks passed, so a goodwill credit has been auto-approved.`;
  }
  if (result.disposition === "escalate_human" && result.goodwill) {
    return `${result.explanation} The automatic goodwill policy did not pass every check, so a specialist will review the recommendation.`;
  }
  return result.explanation;
}
