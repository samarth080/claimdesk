"use client";

import { useState, type FormEvent } from "react";

import type { ManualClaimDetails } from "@/lib/claims/types";

type ManualClaimFormProps = {
  message: string;
  retailerOptions: Array<{ id: string; name: string }>;
  onSubmit: (details: ManualClaimDetails) => Promise<void>;
  onCancel: () => void;
};

export function ManualClaimForm({
  message,
  retailerOptions,
  onSubmit,
  onCancel,
}: ManualClaimFormProps) {
  const [retailerId, setRetailerId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [orderValue, setOrderValue] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ retailerId, orderDate, orderValue });
  }

  const canSubmit = Boolean(retailerId && orderDate && Number(orderValue) > 0);

  return (
    <section aria-labelledby="manual-details-title" className="border border-amber-200 bg-white">
      <div className="border-b border-amber-200 bg-amber-50/60 px-5 py-4 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-800">
          Parsing fallback
        </p>
        <h2 id="manual-details-title" className="mt-2 text-lg font-semibold text-zinc-950">
          Add the three essentials
        </h2>
        <p role="alert" className="mt-2 text-sm leading-6 text-zinc-600">
          {message}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <label htmlFor="manual-retailer" className="block text-xs font-medium text-zinc-700">
            Retailer
          </label>
          <select
            id="manual-retailer"
            value={retailerId}
            onChange={(event) => setRetailerId(event.target.value)}
            required
            className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
          >
            <option value="">Choose a retailer</option>
            {retailerOptions.map((retailer) => (
              <option key={retailer.id} value={retailer.id}>
                {retailer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="manual-order-date" className="block text-xs font-medium text-zinc-700">
              Order date
            </label>
            <input
              id="manual-order-date"
              type="text"
              inputMode="numeric"
              pattern="\d{4}-\d{2}-\d{2}"
              value={orderDate}
              onChange={(event) => setOrderDate(event.target.value)}
              required
              placeholder="YYYY-MM-DD"
              className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
            />
          </div>
          <div>
            <label htmlFor="manual-order-value" className="block text-xs font-medium text-zinc-700">
              Order value
            </label>
            <div className="mt-2 flex border border-zinc-300 bg-white focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700">
              <span className="border-r border-zinc-200 px-3 py-2.5 text-sm text-zinc-500">₹</span>
              <input
                id="manual-order-value"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={orderValue}
                onChange={(event) => setOrderValue(event.target.value)}
                required
                placeholder="2400"
                className="min-w-0 flex-1 px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-950"
          >
            Edit description
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Continue diagnosis
          </button>
        </div>
      </form>
    </section>
  );
}
