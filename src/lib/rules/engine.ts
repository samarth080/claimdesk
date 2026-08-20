import type {
  ClaimContext,
  DiagnosisCode,
  Disposition,
  EscalationPacket,
} from "@/lib/types/domain";

import {
  evaluateGoodwillPolicy,
  type GoodwillPolicyResult,
} from "./goodwill";
import { createNetworkEscalationPacket } from "./escalation";
import { RULES } from "./rules";

export type RuleTraceStatus = "skipped" | "fired" | "not_evaluated";

export type RuleTraceEntry = {
  code: DiagnosisCode;
  status: RuleTraceStatus;
  detail: string;
};

export type DiagnosisResult = {
  code: DiagnosisCode;
  confidence: number;
  disposition: Disposition;
  baseDisposition: Disposition;
  explanation: string;
  goodwill: GoodwillPolicyResult | null;
  escalationPacket: EscalationPacket | null;
  trace: RuleTraceEntry[];
};

export function diagnoseClaim(ctx: ClaimContext): DiagnosisResult {
  const trace: RuleTraceEntry[] = [];
  let matchedRuleIndex = -1;

  for (const [index, rule] of RULES.entries()) {
    if (matchedRuleIndex >= 0) {
      trace.push({
        code: rule.code,
        status: "not_evaluated",
        detail: `Stopped after ${RULES[matchedRuleIndex].code} matched.`,
      });
      continue;
    }

    if (rule.test(ctx)) {
      matchedRuleIndex = index;
      trace.push({
        code: rule.code,
        status: "fired",
        detail: "Evidence test matched.",
      });
    } else {
      trace.push({
        code: rule.code,
        status: "skipped",
        detail: "Evidence test did not match.",
      });
    }
  }

  if (matchedRuleIndex < 0) {
    throw new Error(
      `No diagnosis rule matched claim ${ctx.claim.id}. The taxonomy is not exhaustive for this evidence.`,
    );
  }

  const rule = RULES[matchedRuleIndex];
  const goodwill = rule.goodwillEligible
    ? evaluateGoodwillPolicy({
        diagnosisCode: rule.code,
        claimedOrderValue: ctx.claim.claimedOrderValue,
        creditsInLast90Days: ctx.goodwillCreditsInLast90Days,
      })
    : null;
  const disposition: Disposition = goodwill?.routeToHuman
    ? "escalate_human"
    : rule.disposition;

  return {
    code: rule.code,
    confidence: rule.confidence(ctx),
    disposition,
    baseDisposition: rule.disposition,
    explanation: rule.explain(ctx),
    goodwill,
    escalationPacket:
      rule.disposition === "escalate_network"
        ? createNetworkEscalationPacket(ctx)
        : null,
    trace,
  };
}
