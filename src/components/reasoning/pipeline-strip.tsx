export const PIPELINE_STAGES = [
  {
    key: "evidence",
    title: "Evidence",
    blurb: "Read the click, order, cashback and retailer records",
  },
  {
    key: "rules",
    title: "Rules",
    blurb: "Walk 13 rules in a fixed order, first match wins",
  },
  {
    key: "diagnosis",
    title: "Diagnosis",
    blurb: "One code, with the confidence behind it",
  },
  {
    key: "action",
    title: "Action",
    blurb: "Answer, credit, question or escalation",
  },
] as const;

type StripValues = Partial<Record<(typeof PIPELINE_STAGES)[number]["key"], string>>;

/**
 * The four stages as a single horizontal run. Used on the landing page to set
 * expectations, and above a result to summarise the path that was taken.
 */
export function PipelineStrip({
  values,
  tone = "quiet",
}: {
  values?: StripValues;
  tone?: "quiet" | "loud";
}) {
  const loud = tone === "loud";

  return (
    <ol
      className={`grid gap-px overflow-hidden rounded-lg border sm:grid-cols-4 ${
        loud ? "border-zinc-300 bg-zinc-300" : "border-zinc-200 bg-zinc-200"
      }`}
    >
      {PIPELINE_STAGES.map((stage, index) => {
        const value = values?.[stage.key];

        return (
          <li
            key={stage.key}
            className="relative flex flex-col justify-between bg-white px-3.5 py-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                {index + 1}
              </span>
              <p className="text-[13px] font-semibold tracking-tight text-zinc-900">
                {stage.title}
              </p>
              {index < PIPELINE_STAGES.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="ml-auto font-mono text-xs text-zinc-300"
                >
                  →
                </span>
              ) : null}
            </div>
            <p
              className={`mt-1.5 ${
                value
                  ? "font-mono text-[11px] leading-5 text-zinc-700"
                  : "text-[11px] leading-5 text-zinc-500"
              }`}
            >
              {value ?? stage.blurb}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
