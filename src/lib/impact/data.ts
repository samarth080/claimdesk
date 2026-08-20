import { createServerClient } from "@/lib/supabase/server";

import { summarizeImpact } from "./metrics";

export async function loadImpactSummary() {
  const supabase = createServerClient();
  const result = await supabase
    .from("claims")
    .select("status,diagnosis_code");
  if (result.error || !result.data) {
    throw new Error("Impact data could not be loaded.");
  }

  return summarizeImpact(result.data);
}
