/** Exact paths a scheduled caller may reach without a browser session. */
export function skipsBrowserSession(pathname: string) {
  return pathname === "/api/email/dispatch" || pathname === "/api/n8n/tickets" || /^\/api\/n8n\/tickets\/[\da-f-]{36}\/messages$/i.test(pathname) || /^\/api\/integrations\/(events|tracker-options|tickets\/[\da-f-]{36}(?:\/(?:messages|resolve))?|events\/[\da-f-]{36}\/ack)$/i.test(pathname);
}
