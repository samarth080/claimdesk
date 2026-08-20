import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
}
