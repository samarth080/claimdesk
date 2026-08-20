import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
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
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <AppHeader active="demo" subtitle="CashKaro scenario launcher" />

      <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <p className="brand-eyebrow font-mono text-[10px] uppercase tracking-[0.18em]">Eight seeded journeys</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-zinc-950 sm:text-4xl">
              See the engine make the hard calls.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Each launch submits a real claim against synthetic click, order and retailer evidence. The shown diagnosis is computed live; it is not a pre-rendered result.
            </p>
          </div>
          <aside className="brand-panel rounded-xl border p-4">
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

        <section aria-label="Demo scenarios" className="mt-8 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 shadow-[0_8px_24px_rgba(24,24,27,0.045)] sm:grid-cols-2 xl:grid-cols-4">
          {DEMO_SCENARIOS.map((scenario) => (
            <article key={scenario.key} className="flex min-h-72 flex-col bg-white p-5 transition hover:bg-[#fffaf6]">
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
                  className="brand-button mt-3 flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition"
                >
                  Run scenario
                  <span aria-hidden="true" className="font-mono">→</span>
                </Link>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-5 flex flex-col gap-2 border-l-2 border-zinc-300 pl-4 text-[11px] leading-5 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Independent CashKaro internship prototype. All people, retailers, transactions and evidence are synthetic.</p>
          <p className="font-mono uppercase tracking-[0.12em]">Rules decide · Groq only parses and writes copy</p>
        </div>
      </div>
    </main>
  );
}
