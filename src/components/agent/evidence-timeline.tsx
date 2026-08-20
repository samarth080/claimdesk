import type { AgentTimelineEvent } from "@/lib/agent/types";

const STATE_STYLES = {
  verified: {
    dot: "border-emerald-600 bg-emerald-600",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    label: "Verified",
  },
  warning: {
    dot: "border-amber-600 bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    label: "Attention",
  },
  missing: {
    dot: "border-blue-600 bg-white",
    badge: "border-blue-200 bg-blue-50 text-blue-800",
    label: "Missing evidence",
  },
} as const;

export function EvidenceTimeline({
  events,
  labelId,
}: {
  events: AgentTimelineEvent[];
  labelId: string;
}) {
  return (
    <section aria-labelledby={labelId}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Evidence chain
          </p>
          <h3
            id={labelId}
            className="mt-1 text-base font-semibold text-zinc-950"
          >
            Click → order → cashback
          </h3>
        </div>
        <span className="font-mono text-[10px] text-zinc-400">
          {events.length} checkpoints
        </span>
      </div>

      <ol className="relative mt-5 space-y-0 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-zinc-200">
        {events.map((event) => {
          const style = STATE_STYLES[event.state];
          return (
            <li
              key={event.id}
              className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-4 pb-6 last:pb-0"
            >
              <span
                aria-hidden="true"
                className={`relative z-10 mt-1 size-4 border-2 ${style.dot}`}
              />
              <div className="min-w-0 border border-zinc-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {event.title}
                    </p>
                    <p className="mt-1 font-mono text-[10px] tabular-nums text-zinc-500">
                      {event.timestamp ?? "No timestamp"}
                    </p>
                  </div>
                  <span
                    className={`border px-2 py-0.5 text-[10px] font-medium ${style.badge}`}
                  >
                    {style.label}
                  </span>
                </div>
                <dl className="grid gap-x-5 gap-y-3 px-4 py-3 sm:grid-cols-2">
                  {event.fields.map((field) => (
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
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
