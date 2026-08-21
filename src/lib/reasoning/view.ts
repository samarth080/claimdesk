import type {
  ActionPolicyCheck,
  DiagnosisAction,
  DiagnosisResult,
  RuleOutcome,
} from "@/lib/rules/engine";
import type { EvidenceReading, EvidenceSource } from "@/lib/rules/reading";
import {
  formatIndiaDate,
  formatIndiaDateTime,
  formatRupees,
} from "@/lib/rules/dates";
import type { DiagnosisCode } from "@/lib/types/domain";

import {
  DEVICE_LABELS,
  DIAGNOSIS_LABELS,
  EVIDENCE_FIELD_LABELS,
  EVIDENCE_MISSING_NOTES,
  EVIDENCE_SOURCE_LABELS,
  EVIDENCE_SOURCE_NOTES,
  EVIDENCE_SOURCE_ORDER,
  RULE_EVIDENCE_TESTS,
} from "./labels";

export type EvidenceReadingView = {
  field: string;
  label: string;
  value: string;
  found: boolean;
};

export type EvidenceGroupView = {
  source: EvidenceSource;
  label: string;
  note: string;
  found: number;
  missing: number;
  readings: EvidenceReadingView[];
  /** Fields hidden because the record they belong to does not exist. */
  withheld: number;
  withheldNote: string | null;
};

export type RuleStepView = {
  order: number;
  code: DiagnosisCode;
  label: string;
  test: string;
  outcome: RuleOutcome;
  reason: string;
};

export type ActionTone = "resolved" | "input" | "escalated";

export type ActionPacketView = {
  caseId: string;
  heading: string;
  fields: Array<{ label: string; value: string }>;
  evidenceSummary: string[];
  requestedAction: string;
};

export type ActionView = {
  kind: DiagnosisAction["kind"];
  label: string;
  tone: ActionTone;
  detail: string;
  policyChecks: ActionPolicyCheck[];
  packet: ActionPacketView | null;
};

export type ReasoningView = {
  evidence: EvidenceGroupView[];
  rules: RuleStepView[];
  diagnosis: {
    code: DiagnosisCode;
    label: string;
    confidence: number;
    cause: string;
  };
  action: ActionView;
  summary: {
    evidenceRead: number;
    evidenceMissing: number;
    rulesEvaluated: number;
    rulesNotReached: number;
    matchedAt: number;
  };
};

const MONEY_FIELDS = new Set([
  "order_value",
  "claimed_order_value",
  "cashback_amount",
]);
const DATE_ONLY_FIELDS = new Set(["claimed_order_date"]);
const HOUR_FIELDS = new Set([
  "tracking_sla_hours",
  "hours_since_click",
  "hours_click_to_order",
]);
const DAY_FIELDS = new Set(["confirmation_window_days", "days_since_order"]);

/**
 * The row whose absence makes the rest of its group unreadable. Account and
 * claim-input fields have no such parent, so nothing in them is ever withheld.
 */
const RECORD_FIELD_BY_SOURCE: Partial<Record<EvidenceSource, string>> = {
  retailer: "retailer_record",
  order: "order_record",
  click: "click_record",
  cashback: "cashback_record",
};

const ACTION_PRESENTATION: Record<
  DiagnosisAction["kind"],
  { label: string; tone: ActionTone }
> = {
  message_sent: { label: "Resolution message sent", tone: "resolved" },
  goodwill_credit: { label: "Goodwill credit issued", tone: "resolved" },
  escalated_network: {
    label: "Escalated to the affiliate network",
    tone: "escalated",
  },
  escalated_human: {
    label: "Escalated to a human specialist",
    tone: "escalated",
  },
  question_asked: { label: "One clarifying question asked", tone: "input" },
};

function displayValue(reading: EvidenceReading): string {
  const { field, found, value } = reading;
  if (!found || value === null) {
    return EVIDENCE_MISSING_NOTES[field] ?? "Not recorded";
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "device") return DEVICE_LABELS[String(value)] ?? String(value);
  if (MONEY_FIELDS.has(field)) return formatRupees(Number(value));
  if (DATE_ONLY_FIELDS.has(field)) return formatIndiaDate(String(value));
  if (field.endsWith("_at")) return formatIndiaDateTime(String(value));
  if (HOUR_FIELDS.has(field)) return `${value} h`;
  if (DAY_FIELDS.has(field)) {
    return `${value} ${Number(value) === 1 ? "day" : "days"}`;
  }
  return String(value);
}

function groupEvidence(readings: EvidenceReading[]): EvidenceGroupView[] {
  return EVIDENCE_SOURCE_ORDER.map((source) => {
    const sourceReadings = readings
      .filter((reading) => reading.source === source)
      .map((reading) => ({
        field: reading.field,
        label: EVIDENCE_FIELD_LABELS[reading.field] ?? reading.field,
        value: displayValue(reading),
        found: reading.found,
      }));

    const recordField = RECORD_FIELD_BY_SOURCE[source];
    const recordMissing = sourceReadings.some(
      (reading) => reading.field === recordField && !reading.found,
    );
    const shown = recordMissing
      ? sourceReadings.filter(
          (reading) => reading.field === recordField || reading.found,
        )
      : sourceReadings;
    const withheld = sourceReadings.length - shown.length;

    return {
      source,
      label: EVIDENCE_SOURCE_LABELS[source],
      note: EVIDENCE_SOURCE_NOTES[source],
      found: sourceReadings.filter((reading) => reading.found).length,
      missing: sourceReadings.filter((reading) => !reading.found).length,
      readings: shown,
      withheld,
      withheldNote:
        withheld > 0
          ? `${withheld} further field${withheld === 1 ? "" : "s"} cannot be read without this record.`
          : null,
    };
  });
}

function buildActionView(diagnosis: DiagnosisResult): ActionView {
  const presentation = ACTION_PRESENTATION[diagnosis.action.kind];
  const packet = diagnosis.escalationPacket;

  return {
    kind: diagnosis.action.kind,
    label: presentation.label,
    tone: presentation.tone,
    detail: diagnosis.action.detail,
    policyChecks: diagnosis.action.policyChecks ?? [],
    packet: packet
      ? {
          caseId: packet.caseId,
          heading: "Network claim packet",
          fields: [
            { label: "Case ID", value: packet.caseId },
            { label: "Retailer", value: packet.retailer },
            { label: "Click ID", value: packet.clickId },
            {
              label: "Ordered at",
              value: formatIndiaDateTime(packet.orderedAt),
            },
            { label: "Order value", value: formatRupees(packet.orderValue) },
          ],
          evidenceSummary: packet.evidenceSummary,
          requestedAction: packet.requestedAction,
        }
      : null,
  };
}

/**
 * Turns one engine result into the four stages the product shows: what was
 * read, which rules ran, what was concluded, and what the system then did.
 */
export function buildReasoningView(diagnosis: DiagnosisResult): ReasoningView {
  const evidence = groupEvidence(diagnosis.evidenceRead);
  const rules: RuleStepView[] = diagnosis.trace.map((entry) => ({
    order: entry.order,
    code: entry.code,
    label: DIAGNOSIS_LABELS[entry.code],
    test: RULE_EVIDENCE_TESTS[entry.code],
    outcome: entry.outcome,
    reason: entry.reason,
  }));
  const matchedAt =
    rules.find((rule) => rule.outcome === "matched")?.order ?? rules.length;

  return {
    evidence,
    rules,
    diagnosis: {
      code: diagnosis.code,
      label: DIAGNOSIS_LABELS[diagnosis.code],
      confidence: diagnosis.confidence,
      cause: diagnosis.explanation,
    },
    action: buildActionView(diagnosis),
    summary: {
      evidenceRead: diagnosis.evidenceRead.filter(
        (reading) => reading.found,
      ).length,
      evidenceMissing: diagnosis.evidenceRead.filter(
        (reading) => !reading.found,
      ).length,
      rulesEvaluated: matchedAt,
      rulesNotReached: rules.filter((rule) => rule.outcome === "not_reached")
        .length,
      matchedAt,
    },
  };
}
