import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertPreviewBackend, previewPublicConfig } from "./environment";

// Bypasses RLS. Only call after the caller's permissions were checked on the server.
export function createAdminClient() {
  const { url } = previewPublicConfig();
  assertPreviewBackend(url, process.env.SUPABASE_SECRET_KEY, "secret");
  return createClient(
    url,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
