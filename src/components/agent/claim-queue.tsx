import type { AgentClaimView } from "@/lib/agent/types";
import { formatRupees } from "@/lib/rules/dates";

import { DecisionPath } from "@/components/reasoning/decision-path";

import { CasePacket } from "./case-packet";

export function ClaimQueue({ claims }: { claims: AgentClaimView[] }) {
  if (claims.length === 0) {
    return (
      <div className="brand-panel rounded-xl border px-6 py-12 text-center">
        <p className="text-sm font-medium text-zinc-900">No escalated claims</p>
        <p className="mt-1 text-xs text-zinc-500">
          Correctly escalated cases will appear here with their evidence packet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_8px_24px_rgba(24,24,27,0.045)]">
      <div className="hidden grid-cols-[130px_minmax(180px,1fr)_180px_120px_130px_92px] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 lg:grid">
        <span>Case</span>
        <span>Claimant</span>
        <span>Diagnosis</span>
        <span>Value</span>
        <span>Route</span>
        <span className="text-right">Evidence</span>
      </div>

      {claims.map((claim, index) => (
        <details
          key={claim.id}
          open={index === 0}
          className="group border-b border-zinc-200 bg-white [content-visibility:auto]"
        >
          <summary className="cursor-pointer list-none px-5 py-4 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
            <div className="grid items-center gap-3 lg:grid-cols-[130px_minmax(180px,1fr)_180px_120px_130px_92px] lg:gap-4">
              <div>
                <p className="font-mono text-[11px] font-medium text-zinc-800">
                  {claim.caseId}
                </p>
                <p className="mt-1 font-mono text-[9px] text-zinc-400">
                  {claim.submittedAt}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {claim.claimantName}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                  {claim.retailerName} · {claim.claimantEmail}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] text-blue-700">
                  {claim.diagnosisCode}
                </p>
                <p className="mt-1 font-mono text-[9px] text-zinc-400">
                  {Math.round(claim.confidence * 100)}% confidence
                </p>
              </div>
              <p className="font-mono text-xs tabular-nums text-zinc-700">
                {claim.claimedOrderValue === null
                  ? "—"
                  : formatRupees(claim.claimedOrderValue)}
              </p>
              <span className="w-fit border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-800">
                {claim.route}
              </span>
              <span className="flex items-center justify-end gap-2 text-[11px] font-medium text-zinc-500 group-open:text-blue-700">
                <span className="group-open:hidden">Open</span>
                <span className="hidden group-open:inline">Close</span>
                <span
                  aria-hidden="true"
                  className="font-mono text-base leading-none transition group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </div>
          </summary>

          <div className="border-t border-zinc-200 bg-zinc-50/60 px-5 py-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <div>
                <div className="border-l-2 border-blue-500 pl-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-blue-700">
                    Pre-diagnosed
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-zinc-700">
                    {claim.diagnosisSummary}
                  </p>
                </div>
                <blockquote className="mt-5 rounded-lg border border-zinc-200 bg-white p-4 text-[13px] leading-6 text-zinc-600">
                  &ldquo;{claim.rawText}&rdquo;
                </blockquote>
                {claim.clarification ? (
                  <dl className="mt-4 grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-amber-700">
                        Clarifying question
                      </dt>
                      <dd className="mt-1 text-[12px] leading-5 text-zinc-700">
                        {claim.clarification.question}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-amber-700">
                        User answer
                      </dt>
                      <dd className="mt-1 font-mono text-[12px] leading-5 text-zinc-700">
                        {claim.clarification.answer}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>

              <DecisionPath
                view={claim.reasoning}
                idPrefix={`case-${claim.id}`}
                defaultOpen
                packetSlot={
                  <div className="mt-4">
                    <CasePacket packet={claim.packet} />
                  </div>
                }
              />
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
