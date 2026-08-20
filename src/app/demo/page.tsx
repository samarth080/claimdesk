import type { Metadata } from "next";
import Link from "next/link";

import { DEMO_SCENARIOS } from "@/lib/demo/scenarios";

export const metadata: Metadata = {
  title: "Scenario launcher · ClaimDesk",
  description: "Eight seeded paths through the cashback claim triage engine",
};

const OUTCOME_STYLES = {
  "Auto-resolve": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Ask one question": "border-amber-200 bg-amber-50 text-amber-800",
  Escalate: "border-blue-200 bg-blue-50 text-blue-800",
} as const;

const REVIEW_PATH = [
  ["03", "App handoff", "Policy-aware goodwill"],
  ["07", "Vague", "One-question loop"],
  ["08", "Real failure", "Evidence-led escalation"],
] as const;

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="ClaimDesk intake" className="flex size-7 items-center justify-center bg-emerald-700 font-mono text-xs font-semibold text-white">
              CD
            </Link>
            <div>
              <p className="text-sm font-semibold tracking-tight">ClaimDesk</p>
              <p className="text-[11px] text-zinc-500">Scenario launcher</p>
            </div>
          </div>
          <nav aria-label="Primary navigation" className="flex items-center gap-1">
            <Link href="/" className="hidden px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950 sm:inline-flex">Claim intake</Link>
            <span className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Demo</span>
            <Link href="/agent" className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950">Agent queue</Link>
            <Link href="/impact" className="hidden px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-950 sm:inline-flex">Impact</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700">Eight seeded journeys</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-zinc-950 sm:text-4xl">
              See the engine make the hard calls.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Each launch submits a real claim against synthetic click, order and retailer evidence. The shown diagnosis is computed live; it is not a pre-rendered result.
            </p>
          </div>
          <aside className="border border-zinc-200 bg-white p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">Recommended four-minute path</p>
            <ol className="mt-3 divide-y divide-zinc-100">
              {REVIEW_PATH.map(([number, name, detail]) => (
                <li key={number} className="grid grid-cols-[30px_1fr] gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="font-mono text-[10px] text-zinc-400">{number}</span>
                  <p className="text-xs text-zinc-700"><span className="font-medium text-zinc-950">{name}</span> · {detail}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        <section aria-label="Demo scenarios" className="mt-8 grid border-l border-t border-zinc-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
          {DEMO_SCENARIOS.map((scenario) => (
            <article key={scenario.key} className="flex min-h-72 flex-col border-b border-r border-zinc-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[11px] text-zinc-400">{scenario.number}</span>
                <span className={`border px-2 py-1 text-[10px] font-medium ${OUTCOME_STYLES[scenario.outcome]}`}>
                  {scenario.outcome}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold tracking-tight text-zinc-950">{scenario.name}</h2>
              <p className="mt-2 flex-1 text-xs leading-5 text-zinc-600">{scenario.summary}</p>
              <div className="mt-5 border-t border-zinc-100 pt-4">
                <p className="min-h-8 break-words font-mono text-[9px] leading-4 text-zinc-400">{scenario.expectedCode}</p>
                <Link
                  href={`/?demo=${scenario.key}`}
                  className="mt-3 flex items-center justify-between bg-zinc-950 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  Run scenario
                  <span aria-hidden="true" className="font-mono">→</span>
                </Link>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-5 flex flex-col gap-2 border-l-2 border-zinc-300 pl-4 text-[11px] leading-5 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>All people, retailers, transactions and evidence are synthetic.</p>
          <p className="font-mono uppercase tracking-[0.12em]">Rules decide · Groq only parses and writes copy</p>
        </div>
      </div>
    </main>
  );
}
