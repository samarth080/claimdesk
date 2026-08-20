import type { Metadata } from "next";
import Link from "next/link";

import { ClaimQueue } from "@/components/agent/claim-queue";
import { loadAgentQueue } from "@/lib/agent/queue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent queue · ClaimDesk",
  description: "Pre-diagnosed escalated cashback claims and evidence packets",
};

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-r border-zinc-200 px-5 py-4 last:border-r-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-medium tabular-nums text-zinc-950">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">{detail}</p>
    </div>
  );
}

export default async function AgentPage() {
  const queue = await loadAgentQueue();

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3 sm:px-8">
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
              <p className="text-[11px] text-zinc-500">Support operations</p>
            </div>
          </div>
          <nav aria-label="Primary navigation" className="flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950"
            >
              Claim intake
            </Link>
            <Link
              href="/demo"
              className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950"
            >
              Demo
            </Link>
            <span className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
              Agent queue
            </span>
            <Link
              href="/impact"
              className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950"
            >
              Impact
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-blue-700">
              Escalations only
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-zinc-950">
              Pre-diagnosed claim queue
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Every case arrives with the matched journey, ordered rule trace and
              a filing-ready packet. The agent confirms the evidence instead of
              reconstructing it from logs.
            </p>
          </div>
          <div className="border-l-2 border-blue-400 pl-4 lg:max-w-xs">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              Workflow target
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              From roughly 12 minutes of log-digging to about 40 seconds of
              evidence confirmation.
            </p>
          </div>
        </div>

        <section
          aria-label="Queue summary"
          className="mt-7 grid border border-zinc-200 bg-white sm:grid-cols-2 lg:grid-cols-4"
        >
          <Metric
            label="Open escalations"
            value={String(queue.metrics.total)}
            detail="Correctly routed cases"
          />
          <Metric
            label="Network claims"
            value={String(queue.metrics.network)}
            detail="Clean tracking failures"
          />
          <Metric
            label="Human reviews"
            value={String(queue.metrics.human)}
            detail={`${queue.metrics.goodwillReviews} goodwill policy exceptions`}
          />
          <Metric
            label="Mean confidence"
            value={`${Math.round(queue.metrics.averageConfidence * 100)}%`}
            detail="Engine diagnosis confidence"
          />
        </section>

        <section aria-labelledby="queue-title" className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 id="queue-title" className="text-sm font-semibold text-zinc-900">
              Needs agent confirmation
            </h2>
            <p className="font-mono text-[10px] text-zinc-400">
              {queue.claims.length} cases · newest first
            </p>
          </div>
          <ClaimQueue claims={queue.claims} />
        </section>
      </div>
    </main>
  );
}
