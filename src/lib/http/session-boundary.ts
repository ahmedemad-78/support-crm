/** Exact paths a scheduled caller may reach without a browser session. */
export function skipsBrowserSession(pathname: string) {
  return pathname === "/api/email/dispatch";
}
