import { z } from "zod";

import type { Retailer } from "@/lib/types/domain";

import {
  getGroqTextGenerator,
  type TextGenerator,
} from "./groq";
import { parseClaimDeterministically } from "../claims/parser";
import type { ManualClaimDetails } from "../claims/types";

const parsedClaimSchema = z
  .object({
    retailer: z.string().trim().min(1).nullable(),
    approximate_date: z.string().datetime({ offset: true }).nullable(),
    approximate_value: z.number().positive().nullable(),
    volunteered_signals: z
      .object({
        coupon_mentioned: z.boolean(),
        coupon_code: z.string().trim().min(1).nullable(),
        channel: z.enum(["app", "website", "unknown"]),
        cancelled_or_returned: z.boolean(),
        cart_preloaded: z.boolean().nullable(),
        completed_same_sitting: z.boolean().nullable(),
      })
      .strict(),
  })
  .strict();

export type IntakeParseSource = "ai" | "deterministic_fallback" | "manual";

export type VolunteeredSignals = {
  couponMentioned: boolean;
  couponCode: string | null;
  channel: "app" | "website" | "unknown";
  cancelledOrReturned: boolean;
  cartPreloaded: boolean | null;
  completedSameSitting: boolean | null;
};

export type IntakeParseResult =
  | {
      status: "parsed";
      source: IntakeParseSource;
      retailer: Retailer | null;
      approximateOrderDate: string | null;
      approximateOrderValue: number | null;
      volunteeredSignals: VolunteeredSignals | null;
    }
  | {
      status: "manual_required";
      reason: string;
    };

type ParseClaimInput = {
  rawText: string;
  retailers: Retailer[];
  now: Date;
  manualDetails?: ManualClaimDetails;
  generator?: TextGenerator | null;
};

const SYSTEM_PROMPT = `You extract structured fields from a missing-cashback claim.
Return one JSON object only: no prose and no markdown fences.
Use this exact shape:
{"retailer":string|null,"approximate_date":ISO-8601 string|null,"approximate_value":number|null,"volunteered_signals":{"coupon_mentioned":boolean,"coupon_code":string|null,"channel":"app"|"website"|"unknown","cancelled_or_returned":boolean,"cart_preloaded":boolean|null,"completed_same_sitting":boolean|null}}
Never invent a missing value. Resolve relative dates from the supplied current time. Amounts are Indian rupees.`;

const CLAIM_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retailer: { type: ["string", "null"] },
    approximate_date: { type: ["string", "null"] },
    approximate_value: { type: ["number", "null"] },
    volunteered_signals: {
      type: "object",
      additionalProperties: false,
      properties: {
        coupon_mentioned: { type: "boolean" },
        coupon_code: { type: ["string", "null"] },
        channel: { type: "string", enum: ["app", "website", "unknown"] },
        cancelled_or_returned: { type: "boolean" },
        cart_preloaded: { type: ["boolean", "null"] },
        completed_same_sitting: { type: ["boolean", "null"] },
      },
      required: [
        "coupon_mentioned",
        "coupon_code",
        "channel",
        "cancelled_or_returned",
        "cart_preloaded",
        "completed_same_sitting",
      ],
    },
  },
  required: [
    "retailer",
    "approximate_date",
    "approximate_value",
    "volunteered_signals",
  ],
} as const;

function normaliseRetailer(
  candidateName: string | null,
  retailers: Retailer[],
): Retailer | null {
  if (!candidateName) return null;
  const normalisedCandidate = candidateName.toLocaleLowerCase("en-IN");
  return (
    retailers.find((retailer) => {
      const name = retailer.name.toLocaleLowerCase("en-IN");
      return name === normalisedCandidate || name.includes(normalisedCandidate);
    }) ?? null
  );
}

function parseManualDetails(
  details: ManualClaimDetails,
  retailers: Retailer[],
): IntakeParseResult {
  const retailer = retailers.find((item) => item.id === details.retailerId) ?? null;
  const orderValue = Number(details.orderValue);
  const date = new Date(`${details.orderDate}T12:00:00+05:30`);
  if (!retailer || !Number.isFinite(orderValue) || orderValue <= 0 || Number.isNaN(date.valueOf())) {
    return {
      status: "manual_required",
      reason: "Check the retailer, order date and amount, then try again.",
    };
  }

  return {
    status: "parsed",
    source: "manual",
    retailer,
    approximateOrderDate: date.toISOString(),
    approximateOrderValue: orderValue,
    volunteeredSignals: null,
  };
}

export async function parseClaimAtIntake({
  rawText,
  retailers,
  now,
  manualDetails,
  generator = getGroqTextGenerator(),
}: ParseClaimInput): Promise<IntakeParseResult> {
  if (manualDetails) return parseManualDetails(manualDetails, retailers);

  if (!generator) {
    const fallback = parseClaimDeterministically(rawText, retailers, now);
    return {
      status: "parsed",
      source: "deterministic_fallback",
      retailer: fallback.retailer,
      approximateOrderDate: fallback.approximateOrderDate,
      approximateOrderValue: fallback.approximateOrderValue,
      volunteeredSignals: null,
    };
  }

  try {
    const response = await generator({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({
        current_time: now.toISOString(),
        timezone: "Asia/Kolkata",
        known_retailers: retailers.map((retailer) => retailer.name),
        claim: rawText,
      }),
      maxTokens: 450,
      jsonSchema: {
        name: "claim_intake",
        schema: CLAIM_RESPONSE_SCHEMA,
      },
    });
    const parsed = parsedClaimSchema.parse(JSON.parse(response));
    return {
      status: "parsed",
      source: "ai",
      retailer: normaliseRetailer(parsed.retailer, retailers),
      approximateOrderDate: parsed.approximate_date,
      approximateOrderValue: parsed.approximate_value,
      volunteeredSignals: {
        couponMentioned: parsed.volunteered_signals.coupon_mentioned,
        couponCode: parsed.volunteered_signals.coupon_code,
        channel: parsed.volunteered_signals.channel,
        cancelledOrReturned:
          parsed.volunteered_signals.cancelled_or_returned,
        cartPreloaded: parsed.volunteered_signals.cart_preloaded,
        completedSameSitting:
          parsed.volunteered_signals.completed_same_sitting,
      },
    };
  } catch {
    return {
      status: "manual_required",
      reason:
        "We could not reliably read the order details from that description. Add the three essentials below.",
    };
  }
}
