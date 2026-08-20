import type { DiagnosisCode } from "@/lib/types/domain";

export type ClarifyingUnknown =
  | "order_email"
  | "coupon_source"
  | "entry_channel"
  | "same_sitting"
  | "cart_preloaded"
  | "order_date";

export type ClarifyingQuestionId =
  | "WHICH_EMAIL"
  | "COUPON_SOURCE"
  | "APP_OR_WEBSITE"
  | "SAME_SITTING"
  | "CART_PRELOADED"
  | "ORDER_DATE";

export type QuestionOutcome = {
  answer: string;
  remainingCodes: DiagnosisCode[];
};

export type QuestionSelectionContext = {
  liveCodes: DiagnosisCode[];
  unknowns: ClarifyingUnknown[];
};

export type ClarifyingQuestion = {
  id: ClarifyingQuestionId;
  unknown: ClarifyingUnknown;
  text: string;
  targetCodes: DiagnosisCode[];
  targetAnswer: string;
  otherAnswer: string;
};

export type ScoredQuestion = ClarifyingQuestion & {
  informationGain: number;
  expectedRemainingCodes: number;
  outcomes: QuestionOutcome[];
};

export type ClarifyingQuestionView = {
  id: ClarifyingQuestionId;
  text: string;
  inputType: "email" | "date" | "choice";
  options: Array<{ value: string; label: string }>;
  informationGain: number;
  candidateCountBefore: number;
  expectedRemainingCodes: number;
};

export const CLARIFYING_QUESTIONS: readonly ClarifyingQuestion[] = [
  {
    id: "WHICH_EMAIL",
    unknown: "order_email",
    text: "Which email address did you use for this order?",
    targetCodes: ["ACCOUNT_MISMATCH"],
    targetAnswer: "A different email",
    otherAnswer: "My cashback account email",
  },
  {
    id: "COUPON_SOURCE",
    unknown: "coupon_source",
    text: "Did you apply a coupon code, and where did it come from?",
    targetCodes: ["COUPON_ATTRIBUTION_LOSS"],
    targetAnswer: "Yes, from another coupon source",
    otherAnswer: "No, or it came from the cashback platform",
  },
  {
    id: "APP_OR_WEBSITE",
    unknown: "entry_channel",
    text: "Did you tap through from our app or from the website?",
    targetCodes: ["NATIVE_APP_HANDOFF"],
    targetAnswer: "The app",
    otherAnswer: "The website",
  },
  {
    id: "SAME_SITTING",
    unknown: "same_sitting",
    text: "Did you complete the purchase in the same sitting?",
    targetCodes: ["SESSION_EXPIRED"],
    targetAnswer: "No, I came back later",
    otherAnswer: "Yes, in the same sitting",
  },
  {
    id: "CART_PRELOADED",
    unknown: "cart_preloaded",
    text: "Was anything already in your cart before you tapped through?",
    targetCodes: ["CART_PRELOADED"],
    targetAnswer: "Yes",
    otherAnswer: "No",
  },
  {
    id: "ORDER_DATE",
    unknown: "order_date",
    text: "When did you place the order?",
    targetCodes: ["INSUFFICIENT_EVIDENCE"],
    targetAnswer: "I cannot identify the date",
    otherAnswer: "An approximate order date",
  },
] as const;

function scoreQuestion(
  question: ClarifyingQuestion,
  liveCodes: DiagnosisCode[],
): ScoredQuestion | null {
  const targetCodeSet = new Set(question.targetCodes);
  const targetCodes = liveCodes.filter((code) => targetCodeSet.has(code));
  const otherCodes = liveCodes.filter((code) => !targetCodeSet.has(code));

  if (targetCodes.length === 0 || otherCodes.length === 0) return null;

  const outcomes: QuestionOutcome[] = [
    { answer: question.targetAnswer, remainingCodes: targetCodes },
    { answer: question.otherAnswer, remainingCodes: otherCodes },
  ];
  const expectedRemainingCodes =
    outcomes.reduce(
      (total, outcome) => total + outcome.remainingCodes.length,
      0,
    ) / outcomes.length;

  return {
    ...question,
    outcomes,
    expectedRemainingCodes,
    informationGain: liveCodes.length - expectedRemainingCodes,
  };
}

export function rankClarifyingQuestions(
  ctx: QuestionSelectionContext,
): ScoredQuestion[] {
  const unknowns = new Set(ctx.unknowns);
  const liveCodes = [...new Set(ctx.liveCodes)];

  return CLARIFYING_QUESTIONS.flatMap((question) => {
    if (!unknowns.has(question.unknown)) return [];
    const scored = scoreQuestion(question, liveCodes);
    return scored ? [scored] : [];
  }).sort((left, right) => right.informationGain - left.informationGain);
}

export function pickClarifyingQuestion(
  ctx: QuestionSelectionContext,
): ScoredQuestion | null {
  return rankClarifyingQuestions(ctx)[0] ?? null;
}

export function toClarifyingQuestionView(
  question: ScoredQuestion,
  candidateCountBefore: number,
): ClarifyingQuestionView {
  const inputType =
    question.id === "WHICH_EMAIL"
      ? "email"
      : question.id === "ORDER_DATE"
        ? "date"
        : "choice";

  return {
    id: question.id,
    text: question.text,
    inputType,
    options:
      inputType === "choice"
        ? [
            { value: question.targetAnswer, label: question.targetAnswer },
            { value: question.otherAnswer, label: question.otherAnswer },
          ]
        : [],
    informationGain: question.informationGain,
    candidateCountBefore,
    expectedRemainingCodes: question.expectedRemainingCodes,
  };
}
