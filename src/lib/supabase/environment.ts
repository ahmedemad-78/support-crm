/** This review branch is intentionally pinned to its disposable backend. */
export const PREVIEW_PROJECT_REF = "vojietqeyfkrfisxcsrs";
export const PRODUCTION_PROJECT_REF = "cdtcijbddpirvayanjut";

export function assertPreviewBackend(url: string | undefined, key?: string, audience: "publishable" | "secret" = "publishable") {
  let target: URL;
  try { target = new URL(url ?? ""); } catch { throw new Error("Preview backend is not configured."); }
  if (target.protocol !== "https:" || target.hostname !== `${PREVIEW_PROJECT_REF}.supabase.co` || target.port || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
    throw new Error("Preview cannot connect to this backend. Configure the isolated preview project.");
  }
  if (!key?.trim()) throw new Error("Preview API key is not configured.");
  if (key.startsWith("eyJ")) {
    try {
      const raw = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(raw));
      if (claims.ref !== PREVIEW_PROJECT_REF || claims.role !== (audience === "secret" ? "service_role" : "anon")) throw new Error("wrong project or audience");
    } catch { throw new Error("Preview API key belongs to a different project or is invalid."); }
  } else if (!key.startsWith(audience === "secret" ? "sb_secret_" : "sb_publishable_")) {
    throw new Error("Preview API key is invalid.");
  }
}

export function previewPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assertPreviewBackend(url, key);
  return { url: url!, key: key! };
}

export function previewDeliveryBlocked(pathname: string) {
  return /^\/api\/(?:n8n|integrations|email)(?:\/|$)/.test(pathname);
}
