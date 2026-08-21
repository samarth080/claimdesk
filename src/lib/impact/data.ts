import { createServerClient } from "@/lib/supabase/server";
import type { ClaimStatus, DiagnosisCode } from "@/lib/types/domain";

import { summarizeImpact, type ImpactSummary } from "./metrics";

export type ImpactClaimListRow = {
  id: string;
  reference: string;
  status: ClaimStatus;
  diagnosisCode: DiagnosisCode | null;
  confidence: number | null;
  claimedOrderValue: number | null;
  retailerName: string | null;
  submittedAt: string;
  rawText: string;
};

export type ImpactData = {
  summary: ImpactSummary;
  claims: ImpactClaimListRow[];
};

export async function loadImpactSummary(): Promise<ImpactData> {
  const supabase = createServerClient();
  const [claimsResult, retailersResult] = await Promise.all([
    supabase
      .from("claims")
      .select(
        "id,status,diagnosis_code,confidence,claimed_order_value,claimed_retailer_id,submitted_at,raw_text",
      )
      .order("submitted_at", { ascending: false }),
    supabase.from("retailers").select("id,name"),
  ]);
  if (claimsResult.error || !claimsResult.data) {
    throw new Error("Impact data could not be loaded.");
  }

  const retailerNames = new Map(
    (retailersResult.data ?? []).map((retailer) => [retailer.id, retailer.name]),
  );

  return {
    summary: summarizeImpact(
      claimsResult.data.map((claim) => ({
        status: claim.status,
        diagnosis_code: claim.diagnosis_code,
      })),
    ),
    claims: claimsResult.data.map((claim) => ({
      id: claim.id,
      reference: claim.id.slice(0, 8).toUpperCase(),
      status: claim.status,
      diagnosisCode: claim.diagnosis_code,
      confidence: claim.confidence,
      claimedOrderValue: claim.claimed_order_value,
      retailerName: claim.claimed_retailer_id
        ? retailerNames.get(claim.claimed_retailer_id) ?? null
        : null,
      submittedAt: claim.submitted_at,
      rawText: claim.raw_text,
    })),
  };
}
