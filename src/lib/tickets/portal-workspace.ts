import type { TicketStatus } from "./constants";
export const PORTAL_VIEWS=["all","open","unread","waiting","reopened","finished"] as const;
export type PortalView=typeof PORTAL_VIEWS[number];
export type PortalFilters={view:PortalView;q:string;sort:"activity"|"unread"|"oldest";page:number};
export function portalFilters(params:Record<string,string|string[]|undefined>):PortalFilters{
  const first=(key:string)=>typeof params[key]==="string"?params[key] as string:"";
  const rawPage=first("page");
  return {view:PORTAL_VIEWS.includes(first("view") as PortalView)?first("view") as PortalView:"all",q:first("q").trim().slice(0,120),sort:first("sort")==="unread"?"unread":first("sort")==="oldest"?"oldest":"activity",page:/^\d+$/.test(rawPage)?Math.min(1000000,Math.max(1,Number(rawPage))):1};
}
export function portalQuery(filters:PortalFilters,patch:Partial<PortalFilters>={}){
  const next={...filters,...patch};const p=new URLSearchParams();
  if(next.view!=="all")p.set("view",next.view);if(next.q)p.set("q",next.q);if(next.sort!=="activity")p.set("sort",next.sort);if(next.page>1)p.set("page",String(next.page));
  return p.toString()?`?${p}`:"";
}
export function portalReturnHref(raw:unknown){
 if(typeof raw!=="string"||!raw.startsWith("/portal/my-tickets")||raw.startsWith("//"))return "/portal/my-tickets";
 try{const url=new URL(raw,"https://workspace.invalid");if(url.origin!=="https://workspace.invalid"||url.pathname!=="/portal/my-tickets")return "/portal/my-tickets";return "/portal/my-tickets"+portalQuery(portalFilters(Object.fromEntries(url.searchParams)));}catch{return "/portal/my-tickets";}
}
export type PortalTicketRow={id:string;ticket_number:string;issue_description:string;customer_name:string;status:TicketStatus;source:string;created_at:string;updated_at:string;last_activity_at:string;reopen_count:number;last_reopened_at:string|null;unread_replies:number};
export type PortalWorkspaceData={rows:PortalTicketRow[];matched:number;page:number;pages:number;page_size:number;summary:Record<PortalView,number>&{unread_replies:number}};
