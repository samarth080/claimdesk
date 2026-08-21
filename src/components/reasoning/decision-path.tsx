import type { ReactNode } from "react";

import type {
  ActionView,
  EvidenceGroupView,
  ReasoningView,
  RuleStepView,
} from "@/lib/reasoning/view";

import { PipelineStrip } from "./pipeline-strip";

const ACTION_TONES = {
  resolved: {
    border: "border-emerald-200",
    surface: "bg-emerald-50/50",
    text: "text-emerald-800",
    rule: "border-emerald-500",
  },
  input: {
    border: "border-amber-200",
    surface: "bg-amber-50/50",
    text: "text-amber-800",
    rule: "border-amber-500",
  },
  escalated: {
    border: "border-blue-200",
    surface: "bg-blue-50/50",
    text: "text-blue-800",
    rule: "border-blue-500",
  },
} as const;

function StageHeader({
  step,
  title,
  blurb,
  meta,
}: {
  step: number;
  title: string;
  blurb: string;
  meta: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-2.5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-mini tabular-nums text-zinc-400">
          {String(step).padStart(2, "0")}
        </span>
        <h3 className="text-lead font-semibold tracking-tight text-zinc-950">
          {title}
        </h3>
        <p className="text-mini text-zinc-500">{blurb}</p>
      </div>
      <p className="font-mono text-micro uppercase tracking-[0.12em] text-zinc-500">
        {meta}
      </p>
    </div>
  );
}

function StageJoin() {
  return (
    <div aria-hidden="true" className="flex justify-center py-3">
      <span className="h-6 w-px bg-zinc-300" />
    </div>
  );
}

function EvidenceGroup({ group }: { group: EvidenceGroupView }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 bg-zinc-50/70 px-3.5 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-body font-semibold text-zinc-900">
            {group.label}
          </p>
          <p className="font-mono text-micro tabular-nums text-zinc-500">
            {group.found} read
            {group.missing > 0 ? ` · ${group.missing} absent` : ""}
          </p>
        </div>
        <p className="mt-1 text-mini leading-4 text-zinc-500">{group.note}</p>
      </div>
      <dl className="divide-y divide-zinc-100">
        {group.readings.map((reading) => (
          <div
            key={reading.field}
            className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-baseline gap-3 px-3.5 py-2 ${
              reading.found ? "" : "bg-zinc-50/60"
            }`}
          >
            <dt className="min-w-0">
              <span className="block text-mini leading-4 text-zinc-700">
                {reading.label}
              </span>
              <span className="block truncate font-mono text-micro leading-4 text-zinc-400">
                {reading.field}
              </span>
            </dt>
            <dd
              className={`min-w-0 break-words font-mono text-mini leading-5 ${
                reading.found ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              {reading.value}
              {reading.found ? null : (
                <span className="ml-1.5 inline-block border border-zinc-300 px-1 align-middle text-micro uppercase tracking-[0.1em] text-zinc-500">
                  not found
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {group.withheldNote ? (
        <p className="border-t border-zinc-100 bg-zinc-50/60 px-3.5 py-2 text-micro leading-4 text-zinc-500">
          {group.withheldNote}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The ordered precedence list. The rail on the left is solid while rules are
 * still being evaluated and dashed once one has matched, so the short-circuit
 * is visible rather than inferred.
 */
function RuleLadder({ rules }: { rules: RuleStepView[] }) {
  return (
    <ol className="mt-4">
      {rules.map((rule) => {
        const matched = rule.outcome === "matched";
        const notReached = rule.outcome === "not_reached";

        return (
          <li key={rule.code}>
            <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
              <div
                aria-hidden="true"
                className="relative flex justify-center"
              >
                <span
                  className={`absolute inset-y-0 w-px ${
                    notReached
                      ? "bg-[repeating-linear-gradient(to_bottom,var(--color-zinc-300)_0_3px,transparent_3px_6px)]"
                      : "bg-zinc-300"
                  }`}
                />
                <span
                  className={`relative mt-3 size-2.5 shrink-0 rounded-full border-2 ${
                    matched
                      ? "border-emerald-600 bg-emerald-600"
                      : notReached
                        ? "border-zinc-200 bg-white"
                        : "border-zinc-300 bg-white"
                  }`}
                />
              </div>

              <div
                className={`my-0.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  matched
                    ? "border-emerald-300 bg-white shadow-[0_1px_3px_rgba(24,24,27,0.06)]"
                    : notReached
                      ? "border-transparent bg-transparent"
                      : "border-zinc-200 bg-white"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={`font-mono text-micro tabular-nums ${
                        matched ? "text-emerald-700" : "text-zinc-400"
                      }`}
                    >
                      {String(rule.order).padStart(2, "0")}
                    </span>
                    <span
                      className={`font-mono text-mini ${
                        matched
                          ? "font-semibold text-zinc-950"
                          : notReached
                            ? "text-zinc-400"
                            : "text-zinc-700"
                      }`}
                    >
                      {rule.code}
                    </span>
                    <span
                      className={`text-mini ${
                        notReached ? "text-zinc-300" : "text-zinc-500"
                      }`}
                    >
                      {rule.label}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-detail leading-5 ${
                      matched
                        ? "text-zinc-800"
                        : notReached
                          ? "text-zinc-400"
                          : "text-zinc-600"
                    }`}
                  >
                    {rule.reason}
                  </p>
                </div>

                <span
                  className={`shrink-0 border px-1.5 py-0.5 font-mono text-micro uppercase tracking-[0.1em] ${
                    matched
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : notReached
                        ? "border-zinc-200 text-zinc-400"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500"
                  }`}
                >
                  {matched
                    ? "Matched"
                    : notReached
                      ? "Not reached"
                      : "No match"}
                </span>
              </div>
            </div>

            {matched ? (
              <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
                <span aria-hidden="true" />
                <p className="flex items-center gap-2 py-1.5 font-mono text-micro uppercase tracking-[0.14em] text-emerald-700">
                  <span className="h-px flex-1 bg-emerald-200" />
                  Evaluation stopped here
                  <span className="h-px flex-1 bg-emerald-200" />
                </p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ActionStage({
  action,
  packetSlot,
}: {
  action: ActionView;
  packetSlot?: ReactNode;
}) {
  const tone = ACTION_TONES[action.tone];

  return (
    <div className="mt-4">
      <div
        className={`rounded-lg border ${tone.border} ${tone.surface} px-4 py-3.5`}
      >
        <p
          className={`font-mono text-micro uppercase tracking-[0.14em] ${tone.text}`}
        >
          {action.label}
        </p>
        <p className="mt-1.5 text-body leading-6 text-zinc-700">
          {action.detail}
        </p>
      </div>

      {action.policyChecks.length > 0 ? (
        <div className="mt-4">
          <p className="font-mono text-micro uppercase tracking-[0.14em] text-zinc-500">
            Written policy checks
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {action.policyChecks.map((check) => (
              <li
                key={check.rule}
                className={`rounded-lg border p-3 ${
                  check.passed
                    ? "border-emerald-200 bg-white"
                    : "border-amber-300 bg-amber-50/60"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-micro font-bold text-white ${
                      check.passed ? "bg-emerald-600" : "bg-amber-600"
                    }`}
                  >
                    {check.passed ? "✓" : "!"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-mini font-medium leading-4 text-zinc-800">
                      {check.rule}
                    </p>
                    <p className="mt-1 font-mono text-micro leading-4 text-zinc-500">
                      {check.detail}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {packetSlot ?? (action.packet ? <ActionPacket action={action} /> : null)}
    </div>
  );
}

function ActionPacket({ action }: { action: ActionView }) {
  const packet = action.packet;
  if (!packet) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-blue-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-2.5">
        <p className="font-mono text-micro uppercase tracking-[0.14em] text-blue-800">
          {packet.heading}
        </p>
        <p className="font-mono text-mini text-zinc-700">{packet.caseId}</p>
      </div>
      <dl className="grid gap-x-5 gap-y-2.5 px-4 py-3 sm:grid-cols-3">
        {packet.fields.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="font-mono text-micro uppercase tracking-[0.12em] text-zinc-400">
              {field.label}
            </dt>
            <dd className="mt-0.5 break-words font-mono text-mini text-zinc-800">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-zinc-100 px-4 py-3">
        <p className="font-mono text-micro uppercase tracking-[0.12em] text-zinc-400">
          Evidence filed
        </p>
        <ul className="mt-1.5 space-y-1">
          {packet.evidenceSummary.map((line) => (
            <li
              key={line}
              className="flex gap-2 text-detail leading-5 text-zinc-600"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1 shrink-0 rounded-full bg-blue-400"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-l-2 border-blue-400 pl-3 text-detail leading-5 text-zinc-700">
          {packet.requestedAction}
        </p>
      </div>
    </div>
  );
}

export function DecisionPath({
  view,
  idPrefix,
  defaultOpen = false,
  packetSlot,
}: {
  view: ReasoningView;
  idPrefix: string;
  defaultOpen?: boolean;
  packetSlot?: ReactNode;
}) {
  const { action, diagnosis, evidence, rules, summary } = view;

  return (
    <section aria-labelledby={`${idPrefix}-path`} className="w-full">
      <h2 id={`${idPrefix}-path`} className="sr-only">
        How this claim was decided
      </h2>

      <PipelineStrip
        tone="loud"
        values={{
          evidence: `${summary.evidenceRead} read · ${summary.evidenceMissing} absent`,
          rules: `stopped at ${summary.matchedAt} of ${rules.length}`,
          diagnosis: `${diagnosis.code} · ${Math.round(diagnosis.confidence * 100)}%`,
          action: action.label,
        }}
      />

      <details open={defaultOpen} className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-body font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show how this was decided</span>
          <span className="hidden group-open:inline">Hide the decision path</span>
          <span
            aria-hidden="true"
            className="font-mono text-lead leading-none text-zinc-400 transition group-open:rotate-45"
          >
            +
          </span>
        </summary>

        <div className="mt-4">
          <section aria-label="Stage 1, evidence gathered">
            <StageHeader
              step={1}
              title="Evidence gathered"
              blurb="Every field the rules can read"
              meta={`${summary.evidenceRead + summary.evidenceMissing} fields · ${summary.evidenceMissing} absent`}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {evidence.map((group) => (
                <EvidenceGroup key={group.source} group={group} />
              ))}
            </div>
          </section>

          <StageJoin />

          <section aria-label="Stage 2, rules evaluated">
            <StageHeader
              step={2}
              title="Rules evaluated"
              blurb="Fixed precedence, first match wins"
              meta={`${summary.rulesEvaluated} evaluated · ${summary.rulesNotReached} not reached`}
            />
            <RuleLadder rules={rules} />
          </section>

          <StageJoin />

          <section aria-label="Stage 3, diagnosis">
            <StageHeader
              step={3}
              title="Diagnosis"
              blurb="One code, and why"
              meta={`${Math.round(diagnosis.confidence * 100)}% confidence`}
            />
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white px-4 py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-mono text-body font-semibold text-zinc-950">
                  {diagnosis.code}
                </p>
                <p className="text-body text-zinc-500">{diagnosis.label}</p>
              </div>
              <p className="mt-2 max-w-3xl text-body leading-6 text-zinc-700">
                {diagnosis.cause}
              </p>
            </div>
          </section>

          <StageJoin />

          <section aria-label="Stage 4, action taken">
            <StageHeader
              step={4}
              title="Action taken"
              blurb="What the system did next"
              meta={action.label}
            />
            <ActionStage action={action} packetSlot={packetSlot} />
          </section>
        </div>
      </details>
    </section>
  );
}
