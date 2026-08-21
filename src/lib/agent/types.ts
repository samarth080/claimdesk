import type { ReasoningView } from "@/lib/reasoning/view";
import type { PolicyCheck } from "@/lib/rules/goodwill";
import type {
  DiagnosisCode,
  OrderStatus,
} from "@/lib/types/domain";

export type AgentPacketField = {
  label: string;
  value: string;
};

export type AgentCasePacket = {
  heading: string;
  route: "Affiliate network" | "Human specialist";
  caseId: string;
  identityFields: AgentPacketField[];
  transactionFields: AgentPacketField[];
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
  reasoning: ReasoningView;
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
