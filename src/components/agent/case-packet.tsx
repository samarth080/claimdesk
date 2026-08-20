import type { AgentCasePacket } from "@/lib/agent/types";

import { CopyPacketButton } from "./copy-packet-button";

export function CasePacket({ packet }: { packet: AgentCasePacket }) {
  return (
    <section
      aria-labelledby={`packet-${packet.caseId}`}
      className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-blue-700">
            Ready for {packet.route.toLowerCase()}
          </p>
          <h3
            id={`packet-${packet.caseId}`}
            className="mt-1 text-base font-semibold text-zinc-950"
          >
            {packet.heading}
          </h3>
        </div>
        <CopyPacketButton text={packet.copyText} />
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
        <dl className="grid gap-3 sm:grid-cols-2">
          {[...packet.identityFields, ...packet.transactionFields].map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
                {field.label}
              </dt>
              <dd className="mt-1 break-words font-mono text-[11px] leading-5 text-zinc-700">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
            Evidence summary
          </p>
          <ul className="mt-2 space-y-2">
            {packet.evidenceSummary.map((line) => (
              <li key={line} className="flex gap-2 text-xs leading-5 text-zinc-600">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 bg-blue-500" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-l-2 border-blue-400 pl-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-blue-700">
              Requested action
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-700">
              {packet.requestedAction}
            </p>
          </div>
        </div>
      </div>

      <details className="border-t border-blue-200 bg-white/60">
        <summary className="cursor-pointer px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-800">
          View copy-ready plain text
        </summary>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-blue-100 px-5 py-4 font-mono text-[10px] leading-5 text-zinc-600">
          {packet.copyText}
        </pre>
      </details>
    </section>
  );
}
