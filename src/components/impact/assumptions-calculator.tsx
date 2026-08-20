"use client";

import { useState } from "react";

import {
  calculateAvoidedImpact,
  DEFAULT_IMPACT_ASSUMPTIONS,
} from "@/lib/impact/metrics";

const RUPEE_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return RUPEE_FORMATTER.format(value);
}

function formatAgentTime(minutes: number): string {
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
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
      <label htmlFor={id} className="text-xs font-medium text-zinc-700">
        {label}
      </label>
      <div className="mt-2 flex overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-[#f37021] focus-within:ring-1 focus-within:ring-[#f37021]">
        {prefix ? (
          <span className="border-r border-zinc-200 px-3 py-2.5 font-mono text-sm text-zinc-500">
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
          className="min-w-0 flex-1 px-3 py-2.5 font-mono text-sm tabular-nums text-zinc-950 outline-none"
        />
        {suffix ? (
          <span className="border-l border-zinc-200 px-3 py-2.5 text-xs text-zinc-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AssumptionsCalculator({
  resolvedClaims,
}: {
  resolvedClaims: number;
}) {
  const [costPerClaim, setCostPerClaim] = useState<number>(
    DEFAULT_IMPACT_ASSUMPTIONS.costPerHumanClaim,
  );
  const [handleTime, setHandleTime] = useState<number>(
    DEFAULT_IMPACT_ASSUMPTIONS.handleTimeMinutes,
  );
  const impact = calculateAvoidedImpact(
    resolvedClaims,
    costPerClaim,
    handleTime,
  );

  function resetAssumptions() {
    setCostPerClaim(DEFAULT_IMPACT_ASSUMPTIONS.costPerHumanClaim);
    setHandleTime(DEFAULT_IMPACT_ASSUMPTIONS.handleTimeMinutes);
  }

  return (
    <section
      aria-labelledby="impact-model-title"
      className="brand-panel overflow-hidden rounded-xl border"
    >
      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Editable assumptions
              </p>
              <h2
                id="impact-model-title"
                className="mt-1 text-lg font-semibold tracking-tight text-zinc-950"
              >
                Cost-avoidance model
              </h2>
            </div>
            <button
              type="button"
              onClick={resetAssumptions}
              className="text-[11px] font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
            >
              Reset
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-600">
            These are assumptions, not booked savings. Change either input to
            challenge the model.
          </p>
          <div className="mt-5 grid gap-4">
            <AssumptionInput
              id="cost-per-claim"
              label="Cost per human-handled claim"
              prefix="₹"
              value={costPerClaim}
              step={1}
              onChange={setCostPerClaim}
            />
            <AssumptionInput
              id="handle-time"
              label="Average handle time"
              suffix="minutes"
              value={handleTime}
              step={0.5}
              onChange={setHandleTime}
            />
          </div>
        </div>

        <div aria-live="polite" className="grid sm:grid-cols-3">
          <div className="border-b border-zinc-200 px-5 py-6 sm:border-b-0 sm:border-r">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-700">
              Estimated cost avoided
            </p>
            <p className="mt-3 font-mono text-3xl font-medium tabular-nums text-zinc-950">
              {formatCurrency(impact.estimatedCostAvoided)}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">
              {resolvedClaims} resolved × {formatCurrency(Math.max(0, costPerClaim))}
            </p>
          </div>
          <div className="border-b border-zinc-200 px-5 py-6 sm:border-b-0 sm:border-r">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">
              Agent time avoided
            </p>
            <p className="mt-3 font-mono text-3xl font-medium tabular-nums text-zinc-950">
              {formatAgentTime(impact.agentMinutesAvoided)}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">
              {resolvedClaims} resolved × {Math.max(0, handleTime)} minutes
            </p>
          </div>
          <div className="px-5 py-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">
              Human touches avoided
            </p>
            <p className="mt-3 font-mono text-3xl font-medium tabular-nums text-zinc-950">
              {impact.humanTouchesAvoided}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">
              Only completed auto-resolutions count here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
