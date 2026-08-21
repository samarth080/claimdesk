import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
import { DiagnosisBreakdown } from "@/components/impact/diagnosis-breakdown";
import { ProjectionChain } from "@/components/impact/projection-chain";
import { loadImpactSummary } from "@/lib/impact/data";
import { PRODUCTION_CAVEATS } from "@/lib/impact/metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projected impact · ClaimDesk",
  description:
    "A projection from synthetic claims, with the arithmetic and assumptions shown",
};

function OutcomeMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "resolved" | "input" | "escalated";
}) {
  const toneStyle = {
    neutral: "text-zinc-950",
    resolved: "text-emerald-700",
    input: "text-amber-700",
    escalated: "text-blue-700",
  }[tone];

  return (
    <div className="border-r border-zinc-200 px-5 py-4 last:border-r-0">
      <p className="font-mono text-micro uppercase tracking-[0.15em] text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 font-mono text-headline font-medium tabular-nums ${toneStyle}`}>
        {value}
      </p>
      <p className="mt-1 text-mini text-zinc-500">{detail}</p>
    </div>
  );
}

export default async function ImpactPage() {
  const { claims, summary } = await loadImpactSummary();

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <AppHeader active="impact" subtitle="Projected impact" />

      <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="brand-eyebrow font-mono text-micro uppercase tracking-[0.18em]">
              Projection, not a result
            </p>
            <h1 className="mt-2 max-w-3xl text-display font-semibold tracking-[-0.035em] text-zinc-950">
              Projected impact — synthetic dataset, assumptions below
            </h1>
            <p className="mt-3 max-w-2xl text-body leading-6 text-zinc-600">
              Nothing here has been measured against a real support queue. The
              claim counts are real counts of synthetic claims; everything past
              that point is arithmetic over two editable assumptions, shown one
              step at a time so each step can be disputed on its own.
            </p>
          </div>
          <div className="border-l-2 border-zinc-300 pl-4 lg:max-w-xs">
            <p className="font-mono text-micro uppercase tracking-[0.14em] text-zinc-500">
              What would make this real
            </p>
            <p className="mt-1 text-detail leading-5 text-zinc-600">
              A shadow-mode run against historical claims, with agent overrides
              and reopen rates measured per diagnosis code.
            </p>
          </div>
        </header>

        <section
          aria-label="Claim outcome mix"
          className="brand-panel mt-7 grid overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4"
        >
          <OutcomeMetric
            label="Total claims"
            value={String(summary.total)}
            detail={`${summary.diagnosed} carry a diagnosis code`}
            tone="neutral"
          />
          <OutcomeMetric
            label="Auto-resolved"
            value={`${(summary.resolvedRate * 100).toFixed(1)}%`}
            detail={`${summary.resolved} closed with no human touch`}
            tone="resolved"
          />
          <OutcomeMetric
            label="Needs one answer"
            value={`${(summary.needsInputRate * 100).toFixed(1)}%`}
            detail={`${summary.needsInput} awaiting input, not yet deflected`}
            tone="input"
          />
          <OutcomeMetric
            label="Escalated"
            value={`${(summary.escalatedRate * 100).toFixed(1)}%`}
            detail={`${summary.escalated} correctly routed, still real work`}
            tone="escalated"
          />
        </section>

        <div className="mt-9">
          <ProjectionChain summary={summary} claims={claims} />
        </div>

        <section aria-labelledby="caveats-title" className="mt-10">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-zinc-200 pb-2.5">
            <h2
              id="caveats-title"
              className="text-lead font-semibold tracking-tight text-zinc-950"
            >
              What would change this in production
            </h2>
            <p className="text-mini text-zinc-500">
              The three assumptions most likely to be wrong
            </p>
          </div>
          <ol className="mt-4 grid gap-3 lg:grid-cols-3">
            {PRODUCTION_CAVEATS.map((caveat, index) => (
              <li
                key={caveat.title}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3.5"
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-mini tabular-nums text-zinc-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-body font-semibold text-zinc-900">
                    {caveat.title}
                  </p>
                </div>
                <p className="mt-2 text-detail leading-5 text-zinc-600">
                  {caveat.detail}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10">
          <DiagnosisBreakdown rows={summary.breakdown} />
        </div>

        <p className="mt-8 border-l-2 border-zinc-300 pl-4 text-mini leading-5 text-zinc-500">
          Independent prototype on synthetic data, unaffiliated with any
          company. Claim counts move when demo claims are submitted, so the
          percentages above describe this dataset at this moment rather than a
          fixed benchmark.
        </p>
      </div>
    </main>
  );
}
