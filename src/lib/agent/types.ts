import type { PolicyCheck } from "@/lib/rules/goodwill";
import type {
  DiagnosisCode,
  OrderStatus,
} from "@/lib/types/domain";
import type { RuleTraceStatus } from "@/lib/rules/engine";

export type AgentTimelineField = {
  label: string;
  value: string;
};

export type AgentTimelineEvent = {
  id: string;
  kind: "click" | "order" | "cashback";
  title: string;
  timestamp: string | null;
  state: "verified" | "missing" | "warning";
  fields: AgentTimelineField[];
};

export type AgentRuleTraceEntry = {
  code: DiagnosisCode;
  status: RuleTraceStatus;
  evidenceTest: string;
  detail: string;
};

export type AgentCasePacket = {
  heading: string;
  route: "Affiliate network" | "Human specialist";
  caseId: string;
  identityFields: AgentTimelineField[];
  transactionFields: AgentTimelineField[];
  evidenceSummary: string[];
  requestedAction: string;
  copyText: string;
};

export type AgentClaimView = {
  id: string;
  caseId: string;
  submittedAt: string;
  diagnosisCode: DiagnosisCode;
  confidence: number;
  route: "Affiliate network" | "Human specialist";
  claimantName: string;
  claimantEmail: string;
  claimantTier: "standard" | "gold";
  retailerName: string;
  claimedOrderValue: number | null;
  rawText: string;
  diagnosisSummary: string;
  orderStatus: OrderStatus | null;
  timeline: AgentTimelineEvent[];
  ruleTrace: AgentRuleTraceEntry[];
  packet: AgentCasePacket;
  clarification: {
    question: string;
    answer: string;
  } | null;
  goodwill: {
    recommendation: string;
    approved: boolean;
    checks: PolicyCheck[];
  } | null;
};

export type AgentQueueData = {
  claims: AgentClaimView[];
  metrics: {
    total: number;
    network: number;
    human: number;
    goodwillReviews: number;
    averageConfidence: number;
  };
};
