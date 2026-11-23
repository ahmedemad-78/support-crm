import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { previewPublicConfig } from "./environment";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = previewPublicConfig();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't write cookies; proxy.ts refreshes the session.
          }
        },
      },
    },
  );
}
