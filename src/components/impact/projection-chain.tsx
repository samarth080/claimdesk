"use client";

import { useState } from "react";

import type { ImpactClaimListRow } from "@/lib/impact/data";
import {
  buildProjectionChain,
  DEFAULT_IMPACT_ASSUMPTIONS,
  type ImpactBucket,
  type ImpactSummary,
  type ProjectionStep,
} from "@/lib/impact/metrics";
import { formatIndiaDate, formatRupees } from "@/lib/rules/dates";

const BUCKET_LABELS: Record<ImpactBucket, string> = {
  all: "every claim in the dataset",
  resolved: "claims closed with no human touch",
  needs_input: "claims waiting on one answer",
  escalated: "claims routed to a network or a human",
};

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

function stepValue(step: ProjectionStep): string {
  if (step.unit === "rupees") return formatRupees(Math.round(step.value));
  if (step.unit === "minutes") return formatMinutes(step.value);
  return String(step.value);
}

function AssumptionInput({
  id,
  label,
  prefix,
  suffix,
  value,
  step,
  onChange,
}: {
  id: string;
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[12px] font-medium text-zinc-700">
        {label}
      </label>
      <div className="mt-1.5 flex overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-[#f37021] focus-within:ring-1 focus-within:ring-[#f37021]">
        {prefix ? (
          <span className="border-r border-zinc-200 px-2.5 py-2 font-mono text-[13px] text-zinc-500">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 px-2.5 py-2 font-mono text-[13px] tabular-nums text-zinc-950 outline-none"
        />
        {suffix ? (
          <span className="border-l border-zinc-200 px-2.5 py-2 text-[11px] text-zinc-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ClaimList({
  bucket,
  claims,
  onClose,
}: {
  bucket: ImpactBucket;
  claims: ImpactClaimListRow[];
  onClose: () => void;
}) {
  const filtered =
    bucket === "all"
      ? claims
      : claims.filter((claim) =>
          bucket === "resolved"
            ? claim.status === "resolved"
            : bucket === "needs_input"
              ? claim.status === "needs_input"
              : claim.status === "escalated",
        );

  return (
    <section
      aria-live="polite"
      className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-zinc-900">
            {filtered.length} {BUCKET_LABELS[bucket]}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            The claims behind the number, so the figure can be checked against
            its own rows.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
        >
          Close list
        </button>
      </div>

      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="sticky top-0 border-b border-zinc-200 bg-white font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Claim</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Diagnosis</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Retailer</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Value</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map((claim) => (
              <tr key={claim.id} className="hover:bg-zinc-50/70">
                <td className="px-4 py-2.5">
                  <p className="font-mono text-[11px] text-zinc-800">
                    {claim.reference}
                  </p>
                  <p className="mt-0.5 max-w-xs truncate text-[11px] text-zinc-500">
                    {claim.rawText}
                  </p>
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-mono text-[10px] text-zinc-700">
                    {claim.diagnosisCode ?? "—"}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] text-zinc-400">
                    {claim.confidence === null
                      ? "—"
                      : `${Math.round(claim.confidence * 100)}%`}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-[11px] text-zinc-600">
                  {claim.retailerName ?? "not matched"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[11px] tabular-nums text-zinc-700">
                  {claim.claimedOrderValue === null
                    ? "—"
                    : formatRupees(claim.claimedOrderValue)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[10px] tabular-nums text-zinc-500">
                  {formatIndiaDate(claim.submittedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProjectionChain({
  summary,
  claims,
}: {
  summary: ImpactSummary;
  claims: ImpactClaimListRow[];
}) {
  const [handleTime, setHandleTime] = useState(
    DEFAULT_IMPACT_ASSUMPTIONS.handleTimeMinutes,
  );
  const [costPerMinute, setCostPerMinute] = useState(
    DEFAULT_IMPACT_ASSUMPTIONS.costPerMinute,
  );
  const [bucket, setBucket] = useState<ImpactBucket | null>(null);

  const chain = buildProjectionChain(summary, {
    handleTimeMinutes: handleTime,
    costPerMinute,
  });
  const changed =
    handleTime !== DEFAULT_IMPACT_ASSUMPTIONS.handleTimeMinutes ||
    costPerMinute !== DEFAULT_IMPACT_ASSUMPTIONS.costPerMinute;

  return (
    <section aria-labelledby="projection-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-2.5">
        <div className="flex items-baseline gap-3">
          <h2
            id="projection-title"
            className="text-[15px] font-semibold tracking-tight text-zinc-950"
          >
            The arithmetic
          </h2>
          <p className="text-[11px] text-zinc-500">
            Every step recomputes as the assumptions change
          </p>
        </div>
        {changed ? (
          <button
            type="button"
            onClick={() => {
              setHandleTime(DEFAULT_IMPACT_ASSUMPTIONS.handleTimeMinutes);
              setCostPerMinute(DEFAULT_IMPACT_ASSUMPTIONS.costPerMinute);
            }}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
          >
            Reset defaults
          </button>
        ) : null}
      </div>

      <ol aria-live="polite" className="mt-4 grid gap-2 xl:grid-cols-4">
        {chain.steps.map((step) => {
          const clickable = step.bucket !== null;
          const isCost = step.id === "cost";

          return (
            <li
              key={step.id}
              className={`relative flex flex-col rounded-lg border px-4 py-3.5 ${
                isCost
                  ? "border-zinc-400 bg-white"
                  : "border-zinc-200 bg-white"
              }`}
            >
              {step.operator ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  {step.operator}
                </p>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  start
                </p>
              )}

              <p
                className={`mt-2 font-mono tabular-nums ${
                  isCost
                    ? "text-3xl font-medium text-zinc-950"
                    : "text-2xl font-medium text-zinc-800"
                }`}
              >
                {stepValue(step)}
              </p>
              <p className="mt-1 text-[12px] font-medium text-zinc-800">
                {step.label}
              </p>

              {clickable ? (
                <button
                  type="button"
                  onClick={() =>
                    setBucket(bucket === step.bucket ? null : step.bucket)
                  }
                  className="mt-2 w-fit text-[11px] font-medium text-[#0b5fc6] underline decoration-blue-200 underline-offset-4 hover:decoration-blue-500"
                >
                  {bucket === step.bucket ? "Hide these claims" : "See these claims"}
                </button>
              ) : null}

              <p className="mt-2.5 border-t border-zinc-100 pt-2.5 text-[11px] leading-4 text-zinc-500">
                {step.note}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 sm:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,1fr)] sm:items-start">
        <AssumptionInput
          id="handle-time"
          label="Average handle time"
          suffix="minutes"
          value={handleTime}
          step={0.5}
          onChange={setHandleTime}
        />
        <AssumptionInput
          id="cost-per-minute"
          label="Cost per agent minute"
          prefix="₹"
          value={costPerMinute}
          step={0.5}
          onChange={setCostPerMinute}
        />
        <p className="text-[11px] leading-5 text-zinc-600 sm:pt-6">
          Both are assumptions rather than measurements, and both are wired to
          the chain above. Change either one to see how little the headline
          figure is worth on its own.
        </p>
      </div>

      {bucket ? (
        <ClaimList
          bucket={bucket}
          claims={claims}
          onClose={() => setBucket(null)}
        />
      ) : null}
    </section>
  );
}
