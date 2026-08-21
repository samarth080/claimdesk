import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { CaseArtifacts } from "@/components/demo/case-artifacts";
import { MatchDiagnostics } from "@/components/demo/match-diagnostics";
import { DecisionPath } from "@/components/reasoning/decision-path";
import { loadDemoCase } from "@/lib/demo/case";
import { DEMO_SCENARIOS, getDemoScenario } from "@/lib/demo/scenarios";
import { formatIndiaDateTime, formatRupees } from "@/lib/rules/dates";

export const dynamic = "force-dynamic";

type CasePageProps = {
  params: Promise<{ scenario: string }>;
};

export async function generateMetadata({
  params,
}: CasePageProps): Promise<Metadata> {
  const { scenario: key } = await params;
  const scenario = getDemoScenario(key);

  return {
    title: scenario ? `${scenario.name} · ClaimDesk case file` : "Case file · ClaimDesk",
    description: scenario?.summary ?? "A worked cashback claim, end to end",
  };
}

const OUTCOME_STYLES = {
  "Auto-resolve": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Ask one question": "border-amber-200 bg-amber-50 text-amber-800",
  Escalate: "border-blue-200 bg-blue-50 text-blue-800",
} as const;

function Section({
  step,
  title,
  blurb,
  children,
}: {
  step: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-zinc-200 pb-2.5">
        <span className="font-mono text-mini tabular-nums text-zinc-400">
          {step}
        </span>
        <h2 className="text-lead font-semibold tracking-tight text-zinc-950">
          {title}
        </h2>
        <p className="text-mini text-zinc-500">{blurb}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function DemoCasePage({ params }: CasePageProps) {
  const { scenario: key } = await params;
  const demoCase = await loadDemoCase(key);
  if (!demoCase) notFound();

  const { artifacts, match, parse, reasoning, retailerNames, scenario } =
    demoCase;
  const index = DEMO_SCENARIOS.findIndex((entry) => entry.key === scenario.key);
  const next = DEMO_SCENARIOS[(index + 1) % DEMO_SCENARIOS.length];

  return (
    <main className="min-h-screen bg-background text-zinc-950">
      <AppHeader active="demo" subtitle="Worked case file" maxWidth="wide" />

      <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:py-10">
        <Link
          href="/demo"
          className="font-mono text-mini text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
        >
          ← All case files
        </Link>

        <header className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-mini text-zinc-400">
                Case {scenario.number}
              </span>
              <span
                className={`border px-2 py-0.5 rounded-full text-mini font-medium ${OUTCOME_STYLES[scenario.outcome]}`}
              >
                {scenario.outcome}
              </span>
              {scenario.messy ? (
                <span className="border border-zinc-300 bg-white px-2 py-0.5 rounded-full font-mono text-micro uppercase tracking-[0.1em] text-zinc-600">
                  Messy input
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-display font-semibold tracking-[-0.035em] text-zinc-950">
              {scenario.name}
            </h1>
            <p className="mt-2 max-w-2xl text-body leading-6 text-zinc-600">
              {scenario.summary}
            </p>
          </div>

          <Link
            href={`/?demo=${scenario.key}`}
            className="brand-button w-fit shrink-0 rounded-full px-4 py-2.5 text-body font-semibold transition"
          >
            Run this claim live →
          </Link>
        </header>

        {demoCase.drift ? (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-3.5">
            <p className="font-mono text-micro uppercase tracking-[0.14em] text-amber-900">
              Seeded evidence has aged · showing {demoCase.drift.actual}, written for{" "}
              {demoCase.drift.expected}
            </p>
            <p className="mt-1.5 max-w-3xl text-body leading-6 text-zinc-700">
              {demoCase.drift.detail}
            </p>
          </div>
        ) : null}

        <Section
          step="00"
          title="What the shopper wrote"
          blurb="Free text, exactly as submitted"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            <blockquote className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-body leading-7 text-zinc-800">
              &ldquo;{scenario.rawText}&rdquo;
            </blockquote>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <p className="border-b border-zinc-100 brand-subtle px-4 py-2.5 text-body font-semibold text-zinc-900">
                What the system understood
              </p>
              <dl className="divide-y divide-zinc-100">
                {[
                  ["Retailer", parse.retailer],
                  [
                    "Order date",
                    parse.statedDate
                      ? formatIndiaDateTime(parse.statedDate)
                      : "not stated",
                  ],
                  [
                    "Order value",
                    parse.statedValue === null
                      ? "not stated"
                      : formatRupees(parse.statedValue),
                  ],
                  [
                    "Volunteered",
                    parse.volunteered.length > 0
                      ? parse.volunteered.join(", ")
                      : "nothing extra",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[minmax(0,100px)_minmax(0,1fr)] gap-3 px-4 py-2"
                  >
                    <dt className="text-mini text-zinc-500">{label}</dt>
                    <dd className="font-mono text-mini leading-5 text-zinc-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-zinc-100 brand-subtle px-4 py-2.5 text-mini leading-5 text-zinc-600">
                {parse.note}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <MatchDiagnostics match={match} retailerNames={retailerNames} />
          </div>
        </Section>

        <Section
          step="01–04"
          title="How it was decided"
          blurb="Evidence, rules, diagnosis, action"
        >
          <DecisionPath
            view={reasoning}
            idPrefix={`case-${scenario.key}`}
            defaultOpen
          />
        </Section>

        <Section
          step="05"
          title="What the shopper got back"
          blurb="The exact message sent"
        >
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5">
            <p className="max-w-3xl text-body leading-7 text-zinc-800">
              {demoCase.resolutionMessage}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-2.5 font-mono text-micro uppercase tracking-[0.12em] text-zinc-400">
              <span>
                {demoCase.caseId ? `Case ${demoCase.caseId}` : "No case opened"}
              </span>
              <span>Deterministic copy · Groq may polish the wording live</span>
            </div>
          </div>

          {demoCase.clarifyingQuestion ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3.5">
              <p className="font-mono text-micro uppercase tracking-[0.14em] text-amber-800">
                Question asked ·{" "}
                {demoCase.clarifyingQuestion.candidateCountBefore} candidates → ~
                {demoCase.clarifyingQuestion.expectedRemainingCodes.toFixed(1)}
              </p>
              <p className="mt-1.5 text-body leading-6 text-zinc-800">
                {demoCase.clarifyingQuestion.text}
              </p>
              {demoCase.suggestedAnswer ? (
                <p className="mt-1.5 font-mono text-mini text-zinc-600">
                  Seeded answer: {demoCase.suggestedAnswer}
                </p>
              ) : null}
            </div>
          ) : null}

          {demoCase.limitation ? (
            <div className="mt-3 rounded-xl border border-zinc-300 bg-white px-4 py-3.5">
              <p className="font-mono text-micro uppercase tracking-[0.14em] text-zinc-500">
                Known limitation
              </p>
              <p className="mt-1.5 max-w-3xl text-body leading-6 text-zinc-700">
                {demoCase.limitation}
              </p>
            </div>
          ) : null}
        </Section>

        {artifacts.length > 0 ? (
          <div className="mt-8">
            <CaseArtifacts artifacts={artifacts} />
          </div>
        ) : null}

        <nav className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5">
          <p className="text-mini leading-5 text-zinc-500">
            Independent prototype. All people, retailers and transactions are
            synthetic.
          </p>
          <Link
            href={`/demo/${next.key}`}
            className="font-mono text-mini text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
          >
            Next case: {next.name} →
          </Link>
        </nav>
      </div>
    </main>
  );
}
