import type { Tables } from "@/lib/types/database";
import {
  DIAGNOSIS_CODES,
  type ClaimStatus,
  type DiagnosisCode,
} from "@/lib/types/domain";

export { DIAGNOSIS_LABELS } from "@/lib/reasoning/labels";
import { DIAGNOSIS_LABELS } from "@/lib/reasoning/labels";

export type ImpactBucket = "all" | "resolved" | "needs_input" | "escalated";

export type ImpactAssumptions = {
  handleTimeMinutes: number;
  costPerMinute: number;
};

export const DEFAULT_IMPACT_ASSUMPTIONS: ImpactAssumptions = {
  handleTimeMinutes: 11,
  costPerMinute: 4,
};

/**
 * Where each default came from. Both are assumptions, not measurements, and
 * the page says so — there is no real support queue behind this dataset.
 */
export const ASSUMPTION_NOTES = {
  handleTimeMinutes:
    "Assumed, not measured. A missing-cashback ticket needs an agent to open the claim, pull click and order logs, check retailer terms and write a reply; 11 minutes is a mid-range guess for that, and the real figure varies by claim type.",
  costPerMinute:
    "Assumed, not quoted. A round ₹4 per fully-loaded agent minute, which works out near ₹45 for an 11-minute claim. Substitute your own rate — this input exists to be argued with.",
} as const;

export const PRODUCTION_CAVEATS = [
  {
    title: "Real claims are messier than seeded ones",
    detail:
      "Every seeded claim names a retailer and either a date or a value, so the matcher almost always finds one order. Real free text is vaguer, duplicated and sometimes about several orders at once. Expect more claims to land in the clarification loop, which lowers the auto-resolved count this projection multiplies.",
  },
  {
    title: "GENUINE_TRACKING_FAILURE is a residual bucket",
    detail:
      "It fires when nothing else does — a clean click, an elapsed SLA and no cashback row. On real network data it would fragment into distinct causes such as network reporting lag, retailer feed gaps and genuinely dropped transactions, each with a different route and a different cost.",
  },
  {
    title: "Handle time is not flat",
    detail:
      "One number is applied to every deflected claim here. In practice a 'still inside the SLA' reply is quick and an account-mismatch verification is slow, so the mix of diagnosis codes matters as much as the count. Deflecting cheap claims saves less than this figure implies.",
  },
] as const;


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

export type ProjectionStep = {
  id: "total" | "auto_resolved" | "minutes" | "cost";
  label: string;
  value: number;
  unit: "claims" | "minutes" | "rupees";
  /** Shown between the previous step and this one. */
  operator: string | null;
  note: string;
  bucket: ImpactBucket | null;
};

export type ProjectionChain = {
  steps: ProjectionStep[];
  humanTouchesAvoided: number;
  agentMinutesAvoided: number;
  projectedCostAvoided: number;
};

/**
 * The projection as a visible chain rather than a total. Only claims the
 * engine actually closed count; clarifications and escalations are still
 * operational work and earn no credit here.
 */
export function buildProjectionChain(
  summary: Pick<ImpactSummary, "total" | "resolved">,
  assumptions: ImpactAssumptions,
): ProjectionChain {
  const handleTimeMinutes = Math.max(0, assumptions.handleTimeMinutes);
  const costPerMinute = Math.max(0, assumptions.costPerMinute);
  const resolved = Math.max(0, summary.resolved);
  const minutes = resolved * handleTimeMinutes;
  const cost = minutes * costPerMinute;

  return {
    steps: [
      {
        id: "total",
        label: "Claims in the dataset",
        value: summary.total,
        unit: "claims",
        operator: null,
        note: "Synthetic claims held in the database right now, including any submitted while reviewing the demo.",
        bucket: "all",
      },
      {
        id: "auto_resolved",
        label: "Closed with no human touch",
        value: resolved,
        unit: "claims",
        operator: "of which",
        note: "Only claims whose persisted status is resolved. A claim waiting on a clarifying answer has not been deflected yet.",
        bucket: "resolved",
      },
      {
        id: "minutes",
        label: "Agent minutes not spent",
        value: minutes,
        unit: "minutes",
        operator: `× ${handleTimeMinutes} min average handle time`,
        note: ASSUMPTION_NOTES.handleTimeMinutes,
        bucket: null,
      },
      {
        id: "cost",
        label: "Projected cost avoided",
        value: cost,
        unit: "rupees",
        operator: `× ₹${costPerMinute} per agent minute`,
        note: ASSUMPTION_NOTES.costPerMinute,
        bucket: null,
      },
    ],
    humanTouchesAvoided: resolved,
    agentMinutesAvoided: minutes,
    projectedCostAvoided: cost,
  };
}
