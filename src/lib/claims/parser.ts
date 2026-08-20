import type { Retailer } from "@/lib/types/domain";

const HOURS_AGO_PATTERN = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s+ago/i;
const DAYS_AGO_PATTERN = /(\d+(?:\.\d+)?)\s*days?\s+ago/i;
const ISO_DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2})\b/;
const MONEY_PATTERNS = [
  /₹\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:inr|rs\.?|rupees?)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:for|worth)\s+(?:about\s+|around\s+|like\s+)?([\d,]{3,}(?:\.\d{1,2})?)/i,
] as const;

export type DeterministicParseResult = {
  retailer: Retailer | null;
  approximateOrderValue: number | null;
  approximateOrderDate: string | null;
};

function parseMoney(rawText: string): number | null {
  for (const pattern of MONEY_PATTERNS) {
    const match = rawText.match(pattern);
    if (!match) continue;
    const value = Number(match[1].replaceAll(",", ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function parseApproximateDate(rawText: string, now: Date): string | null {
  const hoursAgo = rawText.match(HOURS_AGO_PATTERN);
  if (hoursAgo) {
    return new Date(
      now.getTime() - Number(hoursAgo[1]) * 60 * 60 * 1000,
    ).toISOString();
  }

  const daysAgo = rawText.match(DAYS_AGO_PATTERN);
  if (daysAgo) {
    return new Date(
      now.getTime() - Number(daysAgo[1]) * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  if (/\byesterday\b/i.test(rawText)) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
  if (/\btoday\b/i.test(rawText)) return now.toISOString();

  const isoDate = rawText.match(ISO_DATE_PATTERN);
  if (isoDate) return new Date(`${isoDate[1]}T12:00:00.000Z`).toISOString();

  return null;
}

export function parseClaimDeterministically(
  rawText: string,
  retailers: Retailer[],
  now = new Date(),
): DeterministicParseResult {
  const normalisedText = rawText.toLocaleLowerCase("en-IN");
  const retailer =
    retailers.find((candidate) =>
      normalisedText.includes(candidate.name.toLocaleLowerCase("en-IN")),
    ) ?? null;

  return {
    retailer,
    approximateOrderValue: parseMoney(rawText),
    approximateOrderDate: parseApproximateDate(rawText, now),
  };
}
