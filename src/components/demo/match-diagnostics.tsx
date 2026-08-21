import { formatIndiaDateTime, formatRupees } from "@/lib/rules/dates";
import type { OrderMatchExplanation } from "@/lib/rules/matching";

const CONSTRAINT_LABELS = {
  user: "Account",
  retailer: "Retailer",
  date: "Date",
  value: "Value",
} as const;

export function MatchDiagnostics({
  match,
  retailerNames,
}: {
  match: OrderMatchExplanation;
  retailerNames: Record<string, string>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-100 brand-subtle px-4 py-2.5">
        <p className="text-body font-semibold text-zinc-900">
          Order matching
        </p>
        <p className="font-mono text-micro uppercase tracking-[0.12em] text-zinc-500">
          ±{match.toleranceHours} h
          {match.valueToleranceRupees !== null
            ? ` · ±${formatRupees(match.valueToleranceRupees)}`
            : ""}
        </p>
      </div>
      <p className="px-4 py-2.5 text-detail leading-5 text-zinc-600">
        {match.headline}
      </p>

      {match.candidates.length > 0 ? (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {match.candidates.map((candidate) => (
            <li
              key={candidate.orderId}
              className={`px-4 py-2.5 ${candidate.selected ? "bg-emerald-50/50" : ""}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-mono text-mini text-zinc-800">
                  {retailerNames[candidate.retailerId] ?? candidate.retailerId} ·{" "}
                  {formatRupees(candidate.orderValue)} ·{" "}
                  {formatIndiaDateTime(candidate.orderedAt)}
                </p>
                <span
                  className={`border px-1.5 py-0.5 rounded-full font-mono text-micro uppercase tracking-[0.1em] ${
                    candidate.selected
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : candidate.passed
                        ? "border-zinc-200 bg-zinc-50 text-zinc-500"
                        : "border-zinc-200 text-zinc-400"
                  }`}
                >
                  {candidate.selected
                    ? "Selected"
                    : candidate.passed
                      ? "Eligible"
                      : "Excluded"}
                </span>
              </div>

              {candidate.exclusions.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {candidate.exclusions.map((exclusion) => (
                    <li
                      key={exclusion.constraint}
                      className="flex flex-wrap items-baseline gap-2 text-mini leading-5 text-zinc-600"
                    >
                      <span className="border border-amber-300 bg-amber-50 px-1 font-mono text-micro uppercase tracking-[0.1em] text-amber-800">
                        {CONSTRAINT_LABELS[exclusion.constraint]}
                      </span>
                      {exclusion.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 font-mono text-micro leading-5 text-zinc-500">
                  {candidate.dateDistanceHours !== null
                    ? `${candidate.dateDistanceHours} h from the stated date`
                    : "no date stated"}
                  {candidate.valueDistance !== null
                    ? ` · ${formatRupees(candidate.valueDistance)} from the stated value`
                    : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
