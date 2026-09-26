import "server-only";
import { createClient } from "@supabase/supabase-js";

// Bypasses RLS. Only call after the caller's permissions were checked on the server.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
