import type { AgentRuleTraceEntry } from "@/lib/agent/types";

const TRACE_STYLES = {
  fired: {
    row: "border-emerald-200 bg-emerald-50/60",
    dot: "bg-emerald-600",
    label: "Fired",
    labelStyle: "text-emerald-800",
  },
  skipped: {
    row: "border-zinc-200 bg-white",
    dot: "bg-zinc-300",
    label: "Skipped",
    labelStyle: "text-zinc-500",
  },
  not_evaluated: {
    row: "border-zinc-100 bg-zinc-50/70",
    dot: "bg-zinc-200",
    label: "Not run",
    labelStyle: "text-zinc-400",
  },
} as const;

export function RuleTrace({
  entries,
  labelId,
}: {
  entries: AgentRuleTraceEntry[];
  labelId: string;
}) {
  return (
    <section aria-labelledby={labelId}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Deterministic engine
          </p>
          <h3
            id={labelId}
            className="mt-1 text-base font-semibold text-zinc-950"
          >
            Ordered rule trace
          </h3>
        </div>
        <span className="font-mono text-[10px] text-zinc-400">
          first match wins
        </span>
      </div>

      <ol className="mt-5 space-y-1.5">
        {entries.map((entry, index) => {
          const style = TRACE_STYLES[entry.status];
          return (
            <li
              key={entry.code}
              className={`grid grid-cols-[28px_minmax(0,1fr)_auto] gap-2 rounded-lg border px-3 py-2.5 ${style.row}`}
            >
              <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 shrink-0 ${style.dot}`} />
                  <p className="truncate font-mono text-[10px] font-medium text-zinc-800">
                    {entry.code}
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                  {entry.evidenceTest}
                </p>
              </div>
              <span
                className={`font-mono text-[9px] uppercase tracking-[0.1em] ${style.labelStyle}`}
              >
                {style.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
