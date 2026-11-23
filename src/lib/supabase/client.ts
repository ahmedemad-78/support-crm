import { createBrowserClient } from "@supabase/ssr";
import { previewPublicConfig } from "./environment";

export function createClient() {
  const { url, key } = previewPublicConfig();
  return createBrowserClient(
    url,
    key,
  );
}
