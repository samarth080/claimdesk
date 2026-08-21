import type { Tables } from "@/lib/types/database";
import {
  DIAGNOSIS_CODES,
  type ClaimStatus,
  type DiagnosisCode,
} from "@/lib/types/domain";

export { DIAGNOSIS_LABELS } from "@/lib/reasoning/labels";
import { DIAGNOSIS_LABELS } from "@/lib/reasoning/labels";

export const DEFAULT_IMPACT_ASSUMPTIONS = {
  costPerHumanClaim: 45,
  handleTimeMinutes: 11,
} as const;


export type DiagnosisImpactRow = {
  code: DiagnosisCode;
  label: string;
  total: number;
  share: number;
  resolved: number;
  needsInput: number;
  escalated: number;
  other: number;
};

export type ImpactSummary = {
  total: number;
  diagnosed: number;
  resolved: number;
  needsInput: number;
  escalated: number;
  other: number;
  resolvedRate: number;
  needsInputRate: number;
  escalatedRate: number;
  breakdown: DiagnosisImpactRow[];
};

export type ImpactClaimRow = Pick<
  Tables<"claims">,
  "status" | "diagnosis_code"
>;

type MutableBreakdown = Omit<DiagnosisImpactRow, "label" | "share">;

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function outcomeKey(
  status: ClaimStatus,
): "resolved" | "needsInput" | "escalated" | "other" {
  if (status === "resolved") return "resolved";
  if (status === "needs_input") return "needsInput";
  if (status === "escalated") return "escalated";
  return "other";
}

export function summarizeImpact(rows: ImpactClaimRow[]): ImpactSummary {
  const byCode = new Map<DiagnosisCode, MutableBreakdown>();
  let resolved = 0;
  let needsInput = 0;
  let escalated = 0;
  let other = 0;
  let diagnosed = 0;

  for (const row of rows) {
    const key = outcomeKey(row.status);
    if (key === "resolved") resolved += 1;
    else if (key === "needsInput") needsInput += 1;
    else if (key === "escalated") escalated += 1;
    else other += 1;

    if (!row.diagnosis_code) continue;
    diagnosed += 1;
    const current = byCode.get(row.diagnosis_code) ?? {
      code: row.diagnosis_code,
      total: 0,
      resolved: 0,
      needsInput: 0,
      escalated: 0,
      other: 0,
    };
    current.total += 1;
    current[key] += 1;
    byCode.set(row.diagnosis_code, current);
  }

  const taxonomyIndex = new Map(
    DIAGNOSIS_CODES.map((code, index) => [code, index]),
  );
  const breakdown = [...byCode.values()]
    .sort(
      (left, right) =>
        right.total - left.total ||
        (taxonomyIndex.get(left.code) ?? 0) -
          (taxonomyIndex.get(right.code) ?? 0),
    )
    .map((row) => ({
      ...row,
      label: DIAGNOSIS_LABELS[row.code],
      share: percentage(row.total, rows.length),
    }));

  return {
    total: rows.length,
    diagnosed,
    resolved,
    needsInput,
    escalated,
    other,
    resolvedRate: percentage(resolved, rows.length),
    needsInputRate: percentage(needsInput, rows.length),
    escalatedRate: percentage(escalated, rows.length),
    breakdown,
  };
}

export function calculateAvoidedImpact(
  resolvedClaims: number,
  costPerHumanClaim: number,
  handleTimeMinutes: number,
) {
  const safeClaims = Math.max(0, resolvedClaims);
  const safeCost = Math.max(0, costPerHumanClaim);
  const safeMinutes = Math.max(0, handleTimeMinutes);

  return {
    humanTouchesAvoided: safeClaims,
    estimatedCostAvoided: safeClaims * safeCost,
    agentMinutesAvoided: safeClaims * safeMinutes,
  };
}
