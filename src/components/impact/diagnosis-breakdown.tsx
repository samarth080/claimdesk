import type { DiagnosisImpactRow } from "@/lib/impact/metrics";

function SegmentBar({ row }: { row: DiagnosisImpactRow }) {
  const segments = [
    { key: "resolved", count: row.resolved, className: "bg-emerald-500" },
    { key: "needs-input", count: row.needsInput, className: "bg-amber-400" },
    { key: "escalated", count: row.escalated, className: "bg-blue-500" },
    { key: "other", count: row.other, className: "bg-zinc-300" },
  ];

  return (
    <div
      role="img"
      className="flex h-2 w-full overflow-hidden bg-zinc-100"
      aria-label={`${row.resolved} resolved, ${row.needsInput} needs input, ${row.escalated} escalated`}
    >
      {segments.map((segment) =>
        segment.count > 0 ? (
          <span
            key={segment.key}
            className={segment.className}
            style={{ width: `${(segment.count / row.total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function DiagnosisBreakdown({
  rows,
}: {
  rows: DiagnosisImpactRow[];
}) {
  return (
    <section aria-labelledby="diagnosis-breakdown-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.18em] text-zinc-500">
            Outcome mix
          </p>
          <h2
            id="diagnosis-breakdown-title"
            className="text-lead font-semibold tracking-tight text-zinc-950"
          >
            Breakdown by diagnosis
          </h2>
        </div>
        <div className="flex flex-wrap gap-4 text-micro text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="size-2 bg-emerald-500" /> Auto-resolved
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 bg-amber-400" /> Needs input
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 bg-blue-500" /> Escalated
          </span>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-[0_8px_24px_rgba(24,24,27,0.04)]">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="border-b border-zinc-200 bg-zinc-50 font-mono text-micro uppercase tracking-[0.14em] text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Diagnosis</th>
              <th scope="col" className="w-20 px-4 py-3 text-right font-medium">Volume</th>
              <th scope="col" className="w-20 px-4 py-3 text-right font-medium">Share</th>
              <th scope="col" className="w-72 px-4 py-3 font-medium">Outcome distribution</th>
              <th scope="col" className="w-28 px-4 py-3 text-right font-medium">Resolved</th>
              <th scope="col" className="w-28 px-4 py-3 text-right font-medium">Escalated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.code} className="hover:bg-zinc-50/70">
                <td className="px-4 py-3.5">
                  <p className="text-detail font-medium text-zinc-800">{row.label}</p>
                  <p className="mt-1 font-mono text-micro text-zinc-400">{row.code}</p>
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-detail tabular-nums text-zinc-700">
                  {row.total}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-detail tabular-nums text-zinc-500">
                  {(row.share * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3.5"><SegmentBar row={row} /></td>
                <td className="px-4 py-3.5 text-right font-mono text-detail tabular-nums text-emerald-700">
                  {row.resolved}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-detail tabular-nums text-blue-700">
                  {row.escalated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
