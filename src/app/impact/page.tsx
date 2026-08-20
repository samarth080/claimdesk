import type { Metadata } from "next";
import Link from "next/link";

import { AssumptionsCalculator } from "@/components/impact/assumptions-calculator";
import { DiagnosisBreakdown } from "@/components/impact/diagnosis-breakdown";
import { loadImpactSummary } from "@/lib/impact/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Impact dashboard · ClaimDesk",
  description: "Claim deflection, escalation mix and editable cost assumptions",
};

function SummaryMetric({
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
    <div className="border-r border-zinc-200 px-5 py-5 last:border-r-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 font-mono text-3xl font-medium tabular-nums ${toneStyle}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">{detail}</p>
    </div>
  );
}

export default async function ImpactPage() {
  const impact = await loadImpactSummary();

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="ClaimDesk intake"
              className="flex size-7 items-center justify-center bg-emerald-700 font-mono text-xs font-semibold text-white"
            >
              CD
            </Link>
            <div>
              <p className="text-sm font-semibold tracking-tight">ClaimDesk</p>
              <p className="text-[11px] text-zinc-500">Product impact</p>
            </div>
          </div>
          <nav aria-label="Primary navigation" className="flex items-center gap-1">
            <Link href="/" className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950">
              Claim intake
            </Link>
            <Link href="/demo" className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950">
              Demo
            </Link>
            <Link href="/agent" className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950">
              Agent queue
            </Link>
            <span className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              Impact
            </span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700">
              Deflection dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-zinc-950">
              What the engine handles — and what it doesn’t
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Live claim outcomes from synthetic evidence. Savings count only
              completed auto-resolutions; clarification and escalation remain
              visible instead of being folded into a flattering headline.
            </p>
          </div>
          <div className="border-l-2 border-zinc-300 pl-4 lg:max-w-xs">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              Measurement note
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              Independent prototype, synthetic data. Cost and time values below
              are explicitly editable assumptions.
            </p>
          </div>
        </div>

        <section
          aria-label="Claim outcome summary"
          className="mt-7 grid border border-zinc-200 bg-white sm:grid-cols-2 lg:grid-cols-4"
        >
          <SummaryMetric
            label="Total claims"
            value={String(impact.total)}
            detail={`${impact.diagnosed} have a diagnosis code`}
            tone="neutral"
          />
          <SummaryMetric
            label="Auto-resolved"
            value={`${(impact.resolvedRate * 100).toFixed(1)}%`}
            detail={`${impact.resolved} claims completed`}
            tone="resolved"
          />
          <SummaryMetric
            label="Needs one answer"
            value={`${(impact.needsInputRate * 100).toFixed(1)}%`}
            detail={`${impact.needsInput} claims awaiting input`}
            tone="input"
          />
          <SummaryMetric
            label="Escalated"
            value={`${(impact.escalatedRate * 100).toFixed(1)}%`}
            detail={`${impact.escalated} correctly routed cases`}
            tone="escalated"
          />
        </section>

        <div className="mt-7">
          <AssumptionsCalculator resolvedClaims={impact.resolved} />
        </div>

        <div className="mt-9">
          <DiagnosisBreakdown rows={impact.breakdown} />
        </div>

        <aside className="mt-7 grid gap-4 border border-zinc-200 bg-white px-5 py-5 text-xs leading-5 text-zinc-600 md:grid-cols-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-emerald-700">
              Counted as deflection
            </p>
            <p className="mt-1">Only claims whose persisted status is resolved.</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-amber-700">
              Not counted yet
            </p>
            <p className="mt-1">Claims waiting for a targeted clarifying answer.</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-blue-700">
              Correct escalation
            </p>
            <p className="mt-1">Network and human cases remain operational work.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
