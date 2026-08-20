"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import {
  answerCashbackClarification,
  diagnoseCashbackClaim,
} from "@/app/actions";
import { AppHeader } from "@/components/app-header";
import { ClarifyingQuestionForm } from "@/components/clarifying-question-form";
import { ManualClaimForm } from "@/components/manual-claim-form";
import type {
  ClaimIntakePayload,
  ClaimIntakeResponse,
  ClaimIntakeSuccess,
  IntakeOutcome,
  ManualClaimDetails,
} from "@/lib/claims/types";
import type { ClarifyingQuestionId } from "@/lib/rules/questions";
import type { DemoScenarioKey } from "@/lib/demo/scenarios";
import type { DiagnosisCode } from "@/lib/types/domain";

const PROGRESS_STEPS = [
  { label: "Matching order", detail: "Retailer, date and value" },
  { label: "Reading the journey", detail: "Click, device and referral" },
  { label: "Applying policy", detail: "Ordered rule precedence" },
] as const;

const EVIDENCE_CHECKS = [
  ["01", "Order match", "Retailer, amount and timing"],
  ["02", "Tracking trail", "Click and session integrity"],
  ["03", "Retailer rules", "SLA, category and coupon policy"],
  ["04", "Correct route", "Resolve, clarify or escalate"],
] as const;

const PARSER_SOURCE_LABELS = {
  ai: "Groq parsed",
  deterministic_fallback: "Deterministic fallback",
  manual: "Manual fallback",
  demo: "Seeded demo evidence",
  stored_claim: "Stored intake + answer",
} as const;

const COPY_SOURCE_LABELS = {
  ai: "Groq polished",
  template_fallback: "Template fallback",
} as const;

const OUTCOME_STYLES: Record<
  IntakeOutcome,
  { badge: string; border: string; dot: string; label: string }
> = {
  resolved: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "Resolved instantly",
  },
  needs_input: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
    label: "One detail needed",
  },
  escalated: {
    badge: "border-blue-200 bg-blue-50 text-blue-800",
    border: "border-blue-200",
    dot: "bg-blue-500",
    label: "Escalated correctly",
  },
};

function CheckMark({ passed }: { passed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center border text-[11px] font-semibold ${
        passed
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-amber-300 bg-amber-50 text-amber-800"
      }`}
    >
      {passed ? "✓" : "!"}
    </span>
  );
}

function DiagnosisProgress() {
  return (
    <section
      aria-live="polite"
      aria-label="Diagnosis in progress"
      className="border border-zinc-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-zinc-950">Diagnosing your claim</p>
          <p className="mt-1 text-xs text-zinc-500">
            Reading the evidence before choosing an answer.
          </p>
        </div>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 bg-emerald-600" />
        </span>
      </div>
      <ol className="divide-y divide-zinc-100 px-5">
        {PROGRESS_STEPS.map((step, index) => (
          <li key={step.label} className="flex items-center gap-4 py-3.5">
            <span className="font-mono text-[11px] tabular-nums text-zinc-400">
              0{index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-800">{step.label}</p>
              <p className="text-xs text-zinc-500">{step.detail}</p>
            </div>
            <span className="size-1.5 animate-pulse bg-zinc-300" />
          </li>
        ))}
      </ol>
    </section>
  );
}

function DiagnosisResult({
  result,
  onReset,
  onClarify,
  suggestedAnswer,
}: {
  result: ClaimIntakeSuccess;
  onReset: () => void;
  onClarify: (questionId: ClarifyingQuestionId, answer: string) => Promise<void>;
  suggestedAnswer: string | null;
}) {
  const style = OUTCOME_STYLES[result.outcome];
  const referenceId = result.caseId ?? result.claimId;

  return (
    <section
      aria-live="polite"
      className={`border bg-white ${style.border}`}
    >
      <div className="border-b border-zinc-200 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-medium ${style.badge}`}
          >
            <span className={`size-1.5 ${style.dot}`} />
            {style.label}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-zinc-500">
            {result.code} · {Math.round(result.confidence * 100)}% confidence
          </span>
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">
          {result.title}
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-zinc-600">
          {result.message}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          <span>
            Intake: {PARSER_SOURCE_LABELS[result.parserSource]}
          </span>
          <span>
            Copy: {COPY_SOURCE_LABELS[result.copySource]}
          </span>
          {result.clarificationApplied ? (
            <span className="text-amber-700">Updated after one answer</span>
          ) : null}
        </div>
      </div>

      {result.clarifyingQuestion ? (
        <div className="border-b border-zinc-200 bg-amber-50/60 px-5 py-5 sm:px-6">
          <ClarifyingQuestionForm
            question={result.clarifyingQuestion}
            onSubmit={onClarify}
            suggestedAnswer={suggestedAnswer}
          />
        </div>
      ) : null}

      {result.goodwill ? (
        <div className="border-b border-zinc-200 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                Goodwill policy
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {result.goodwill.approved
                  ? "Auto-approved from written criteria"
                  : "Sent for a policy exception review"}
              </p>
            </div>
            <span className="text-xs text-zinc-500">
              {result.goodwill.checks.filter((check) => check.passed).length}/
              {result.goodwill.checks.length} checks passed
            </span>
          </div>
          <ul className="mt-4 grid gap-2">
            {result.goodwill.checks.map((check) => (
              <li
                key={check.id}
                className="flex items-start gap-3 border border-zinc-200 p-3"
              >
                <CheckMark passed={check.passed} />
                <div>
                  <p className="text-xs font-medium text-zinc-800">{check.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                    {check.evidence}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 bg-zinc-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
            {result.caseId ? "Case ID" : "Claim ID"}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-700">{referenceId}</p>
          {result.eta ? <p className="mt-1 text-xs text-zinc-500">{result.eta}</p> : null}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Check another claim
        </button>
      </div>
    </section>
  );
}

type DemoLaunch = {
  key: DemoScenarioKey;
  name: string;
  expectedCode: DiagnosisCode;
  summary: string;
  rawText: string;
  suggestedAnswer: string | null;
};

export function ClaimIntake({ demoScenario }: { demoScenario: DemoLaunch | null }) {
  const [rawText, setRawText] = useState(demoScenario?.rawText ?? "");
  const [demoActive, setDemoActive] = useState(Boolean(demoScenario));
  const [status, setStatus] = useState<
    "idle" | "diagnosing" | "manual" | "complete" | "error"
  >("idle");
  const [response, setResponse] = useState<ClaimIntakeResponse | null>(null);
  const launchedDemo = useRef(false);

  const runDiagnosis = useCallback(async (payload: ClaimIntakePayload) => {
    setResponse(null);
    setStatus("diagnosing");

    const minimumWait = new Promise((resolve) => window.setTimeout(resolve, 950));
    const [nextResponse] = await Promise.all([
      diagnoseCashbackClaim(payload),
      minimumWait,
    ]);

    setResponse(nextResponse);
    if (nextResponse.success) {
      setStatus("complete");
    } else if (nextResponse.kind === "manual_entry_required") {
      setStatus("manual");
    } else {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!demoScenario || launchedDemo.current) return;
    launchedDemo.current = true;
    void runDiagnosis({
      rawText: demoScenario.rawText,
      demoScenarioKey: demoScenario.key,
    });
  }, [demoScenario, runDiagnosis]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runDiagnosis({ rawText });
  }

  async function handleManualSubmit(details: ManualClaimDetails) {
    await runDiagnosis({ rawText, manualDetails: details });
  }

  async function handleClarification(
    questionId: ClarifyingQuestionId,
    answer: string,
  ) {
    if (!response?.success) return;

    setStatus("diagnosing");
    const minimumWait = new Promise((resolve) => window.setTimeout(resolve, 700));
    const [nextResponse] = await Promise.all([
      answerCashbackClarification({
        claimId: response.claimId,
        questionId,
        answer,
      }),
      minimumWait,
    ]);

    setResponse(nextResponse);
    setStatus(nextResponse.success ? "complete" : "error");
  }

  function handleReset() {
    setRawText("");
    setResponse(null);
    setStatus("idle");
    setDemoActive(false);
    window.history.replaceState({}, "", "/");
  }

  const manualResponse =
    response && !response.success && response.kind === "manual_entry_required"
      ? response
      : null;
  const errorResponse =
    response && !response.success && response.kind === "error" ? response : null;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <AppHeader active="intake" subtitle="CashKaro support concept" />

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:py-16">
        <div className="min-w-0">
          <div className="max-w-2xl">
            {demoActive && demoScenario ? (
              <div className="mb-6 flex flex-col gap-3 rounded-r-lg border-l-[3px] border-[#f37021] bg-[#fff5ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#d6570b]">
                    Demo scenario · {demoScenario.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    {demoScenario.summary} Expected first code: {demoScenario.expectedCode}.
                  </p>
                </div>
                <Link href="/demo" className="shrink-0 text-xs font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950">
                  All scenarios
                </Link>
              </div>
            ) : null}
            <p className="brand-eyebrow font-mono text-[11px] uppercase tracking-[0.18em]">
              CashKaro support concept
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-zinc-950 sm:text-4xl">
              Tell us what happened.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-zinc-600">
              Write it as you would to support. We’ll match the order, inspect the
              tracking evidence and give you a specific answer.
            </p>
          </div>

          <div className="mt-8 max-w-2xl">
            {status === "idle" ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="brand-panel overflow-hidden rounded-xl border focus-within:border-[#f37021] focus-within:ring-1 focus-within:ring-[#f37021]">
                  <label
                    htmlFor="claim-description"
                    className="block border-b border-zinc-100 px-4 py-3 text-xs font-medium text-zinc-700"
                  >
                    Describe your missing cashback
                  </label>
                  <textarea
                    id="claim-description"
                    name="claim-description"
                    value={rawText}
                    onChange={(event) => setRawText(event.target.value)}
                    maxLength={1500}
                    rows={6}
                    placeholder="I ordered home supplies from Nimbus Mart about 6 hours ago for ₹1,849, but the cashback is not showing."
                    className="block w-full resize-none bg-transparent px-4 py-4 text-[15px] leading-7 text-zinc-950 outline-none placeholder:text-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                  />
                  <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
                    <span>Retailer, approximate date and value help most</span>
                    <span className="font-mono tabular-nums">{rawText.length}/1500</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs leading-5 text-zinc-500">
                    No payment or account changes are made.
                  </p>
                  <button
                    type="submit"
                    disabled={rawText.trim().length < 12}
                    className="brand-button shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
                  >
                    Check my claim
                  </button>
                </div>
              </form>
            ) : null}

            {status === "diagnosing" ? (
              <div className="mt-6">
                <DiagnosisProgress />
              </div>
            ) : null}

            {status === "complete" && response?.success ? (
              <DiagnosisResult
                result={response}
                onReset={handleReset}
                onClarify={handleClarification}
                suggestedAnswer={demoActive ? demoScenario?.suggestedAnswer ?? null : null}
              />
            ) : null}

            {status === "manual" && manualResponse ? (
              <ManualClaimForm
                message={manualResponse.error}
                retailerOptions={manualResponse.retailerOptions}
                onSubmit={handleManualSubmit}
                onCancel={() => setStatus("idle")}
              />
            ) : null}

            {status === "error" && errorResponse ? (
              <div className="border border-amber-200 bg-white p-6">
                <p role="alert" className="text-sm text-amber-900">{errorResponse.error}</p>
                <button
                  type="button"
                  onClick={() => setStatus("idle")}
                  className="mt-4 border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-500"
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="brand-panel h-fit rounded-xl border p-5 lg:mt-28">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            What we check
          </p>
          <ol className="mt-4 space-y-4">
            {EVIDENCE_CHECKS.map(([number, title, detail]) => (
              <li key={number} className="grid grid-cols-[28px_1fr] gap-2">
                <span className="font-mono text-[11px] text-zinc-400">{number}</span>
                <div>
                  <p className="text-xs font-medium text-zinc-800">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-500">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 border-l-2 border-[#0b5fc6] bg-[#eef6ff] px-3 py-2 text-[11px] leading-5 text-zinc-600">
            Diagnosis is deterministic. No language model chooses the outcome.
          </p>
        </aside>
      </div>
    </main>
  );
}
