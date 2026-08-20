import type { DiagnosisCode } from "@/lib/types/domain";

import { formatRupees } from "./dates";

export const GOODWILL_POLICY = {
  eligibleCodes: ["NATIVE_APP_HANDOFF", "REFERRER_STRIPPED"] as const,
  maximumClaimedValue: 2_000,
  maximumPriorCreditsIn90Days: 2,
  lookbackDays: 90,
} as const;

export type PolicyCheck = {
  id: "platform_cause" | "claim_value" | "recent_credit_count";
  label: string;
  passed: boolean;
  evidence: string;
};

export type GoodwillPolicyResult = {
  applicable: boolean;
  approved: boolean;
  routeToHuman: boolean;
  checks: PolicyCheck[];
  recommendation: string;
};

export type GoodwillPolicyInput = {
  diagnosisCode: DiagnosisCode;
  claimedOrderValue: number | null;
  creditsInLast90Days: number;
};

export function evaluateGoodwillPolicy(
  input: GoodwillPolicyInput,
): GoodwillPolicyResult {
  const platformCause = GOODWILL_POLICY.eligibleCodes.some(
    (code) => code === input.diagnosisCode,
  );
  const valueEligible =
    input.claimedOrderValue !== null &&
    input.claimedOrderValue <= GOODWILL_POLICY.maximumClaimedValue;
  const frequencyEligible =
    input.creditsInLast90Days <=
    GOODWILL_POLICY.maximumPriorCreditsIn90Days;

  const checks: PolicyCheck[] = [
    {
      id: "platform_cause",
      label: "Platform-side cause",
      passed: platformCause,
      evidence: platformCause
        ? `${input.diagnosisCode} is an eligible platform-side cause.`
        : `${input.diagnosisCode} is not eligible for goodwill credit.`,
    },
    {
      id: "claim_value",
      label: `Claimed value at or below ${formatRupees(GOODWILL_POLICY.maximumClaimedValue)}`,
      passed: valueEligible,
      evidence:
        input.claimedOrderValue === null
          ? "Claimed value is unknown."
          : `Claimed value is ${formatRupees(input.claimedOrderValue)}.`,
    },
    {
      id: "recent_credit_count",
      label: `No more than ${GOODWILL_POLICY.maximumPriorCreditsIn90Days} prior credits in ${GOODWILL_POLICY.lookbackDays} days`,
      passed: frequencyEligible,
      evidence: `${input.creditsInLast90Days} goodwill credits were awarded in the last ${GOODWILL_POLICY.lookbackDays} days.`,
    },
  ];

  if (!platformCause) {
    return {
      applicable: false,
      approved: false,
      routeToHuman: false,
      checks,
      recommendation: "Goodwill credit is not applicable to this diagnosis.",
    };
  }

  const approved = checks.every((check) => check.passed);
  return {
    applicable: true,
    approved,
    routeToHuman: !approved,
    checks,
    recommendation: approved
      ? "Auto-approve a goodwill credit under the written policy."
      : "Route to a human with a goodwill-credit recommendation and the failed policy checks.",
  };
}
