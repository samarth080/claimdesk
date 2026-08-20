import type { PolicyCheck } from "@/lib/rules/goodwill";
import type {
  ClarifyingQuestionId,
  ClarifyingQuestionView,
} from "@/lib/rules/questions";
import type { DiagnosisCode } from "@/lib/types/domain";
import type { DemoScenarioKey } from "@/lib/demo/scenarios";

export type IntakeOutcome = "resolved" | "needs_input" | "escalated";

export type ManualClaimDetails = {
  retailerId: string;
  orderDate: string;
  orderValue: string;
};

export type ClaimIntakePayload = {
  rawText: string;
  manualDetails?: ManualClaimDetails;
  demoScenarioKey?: DemoScenarioKey;
};

export type ClarifyingAnswerPayload = {
  claimId: string;
  questionId: ClarifyingQuestionId;
  answer: string;
};

export type ClaimIntakeSuccess = {
  success: true;
  claimId: string;
  caseId: string | null;
  outcome: IntakeOutcome;
  code: DiagnosisCode;
  confidence: number;
  title: string;
  message: string;
  clarifyingQuestion: ClarifyingQuestionView | null;
  clarificationApplied: boolean;
  eta: string | null;
  goodwill: {
    approved: boolean;
    recommendation: string;
    checks: PolicyCheck[];
  } | null;
  parserSource:
    | "ai"
    | "deterministic_fallback"
    | "manual"
    | "demo"
    | "stored_claim";
  copySource: "ai" | "template_fallback";
};

export type ClaimIntakeFailure = {
  success: false;
  kind: "error";
  error: string;
};

export type ClaimIntakeManualRequired = {
  success: false;
  kind: "manual_entry_required";
  error: string;
  retailerOptions: Array<{ id: string; name: string }>;
};

export type ClaimIntakeResponse =
  | ClaimIntakeSuccess
  | ClaimIntakeFailure
  | ClaimIntakeManualRequired;
