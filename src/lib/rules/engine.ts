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
import { readEvidence, type EvidenceReading } from "./reading";
import { RULES } from "./rules";

export type { EvidenceReading, EvidenceSource } from "./reading";

export type RuleTraceStatus = "skipped" | "fired" | "not_evaluated";

/** The same three states, named for a reader rather than for the loop. */
export type RuleOutcome = "matched" | "not_matched" | "not_reached";

const OUTCOME_BY_STATUS: Record<RuleTraceStatus, RuleOutcome> = {
  fired: "matched",
  skipped: "not_matched",
  not_evaluated: "not_reached",
};

export type RuleTraceEntry = {
  code: DiagnosisCode;
  status: RuleTraceStatus;
  detail: string;
  /** 1-based position in the precedence array. */
  order: number;
  outcome: RuleOutcome;
  /** One line naming the evidence this rule read, or why it never ran. */
  reason: string;
};

export type ActionPolicyCheck = {
  rule: string;
  passed: boolean;
  detail: string;
};

export type DiagnosisAction = {
  kind:
    | "message_sent"
    | "goodwill_credit"
    | "escalated_network"
    | "escalated_human"
    | "question_asked";
  detail: string;
  policyChecks?: ActionPolicyCheck[];
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
  evidenceRead: EvidenceReading[];
  action: DiagnosisAction;
};

function toPolicyChecks(goodwill: GoodwillPolicyResult): ActionPolicyCheck[] {
  return goodwill.checks.map((check) => ({
    rule: check.label,
    passed: check.passed,
    detail: check.evidence,
  }));
}

function describeAction(input: {
  disposition: Disposition;
  goodwill: GoodwillPolicyResult | null;
  escalationPacket: EscalationPacket | null;
}): DiagnosisAction {
  const { disposition, escalationPacket, goodwill } = input;

  if (disposition === "escalate_network") {
    return {
      kind: "escalated_network",
      detail: escalationPacket
        ? `Case ${escalationPacket.caseId} was drafted for ${escalationPacket.retailer} with ${escalationPacket.evidenceSummary.length} evidence lines and sent to the affiliate network for validation.`
        : "A network case was opened, but the evidence packet could not be assembled from this snapshot.",
    };
  }

  if (disposition === "escalate_human") {
    return {
      kind: "escalated_human",
      detail:
        goodwill?.recommendation ??
        "Routed to a specialist with the matched evidence attached.",
      ...(goodwill ? { policyChecks: toPolicyChecks(goodwill) } : {}),
    };
  }

  if (disposition === "needs_input") {
    return {
      kind: "question_asked",
      detail:
        "One targeted clarifying question was asked; the same evidence checks rerun against the answer.",
    };
  }

  if (goodwill?.approved) {
    return {
      kind: "goodwill_credit",
      detail: `Goodwill credit auto-approved: all ${goodwill.checks.length} written policy checks passed.`,
      policyChecks: toPolicyChecks(goodwill),
    };
  }

  return {
    kind: "message_sent",
    detail:
      "The diagnosis was written back to the claimant as a resolution message. No credit, case or human touch was created.",
  };
}

export function diagnoseClaim(ctx: ClaimContext): DiagnosisResult {
  const trace: RuleTraceEntry[] = [];
  let matchedRuleIndex = -1;

  for (const [index, rule] of RULES.entries()) {
    const order = index + 1;

    if (matchedRuleIndex >= 0) {
      const matchedRule = RULES[matchedRuleIndex];
      trace.push({
        code: rule.code,
        status: "not_evaluated",
        detail: `Stopped after ${matchedRule.code} matched.`,
        order,
        outcome: "not_reached",
        reason: `Not evaluated — ${matchedRule.code} matched at position ${matchedRuleIndex + 1}.`,
      });
      continue;
    }

    const status: RuleTraceStatus = rule.test(ctx) ? "fired" : "skipped";
    if (status === "fired") matchedRuleIndex = index;
    trace.push({
      code: rule.code,
      status,
      detail:
        status === "fired"
          ? "Evidence test matched."
          : "Evidence test did not match.",
      order,
      outcome: OUTCOME_BY_STATUS[status],
      reason: rule.reason(ctx),
    });
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
  const escalationPacket =
    rule.disposition === "escalate_network"
      ? createNetworkEscalationPacket(ctx)
      : null;

  return {
    code: rule.code,
    confidence: rule.confidence(ctx),
    disposition,
    baseDisposition: rule.disposition,
    explanation: rule.explain(ctx),
    goodwill,
    escalationPacket,
    trace,
    evidenceRead: readEvidence(ctx),
    action: describeAction({ disposition, goodwill, escalationPacket }),
  };
}
