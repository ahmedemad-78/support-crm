import { PortalTicketList } from "@/components/tickets/portal-ticket-list";
import { UserNotifications } from "@/components/app-shell/user-notifications";
import { PORTAL_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { portalFilters, type PortalWorkspaceData } from "@/lib/tickets/portal-workspace";
export default async function MyTicketsPage({searchParams}:PageProps<"/portal/my-tickets">){
 const user=await requireUser([...PORTAL_ROLES]);const params=await searchParams;const filters=portalFilters(params);
 const db=await createClient();const {data,error}=await db.rpc("my_ticket_workspace",{p_view:filters.view,p_search:filters.q,p_page:filters.page,p_sort:filters.sort});
 if(error)throw error;
 const submitted=typeof params.submitted==="string"&&/^TKT-[\w-]{1,50}$/.test(params.submitted)?params.submitted:undefined;
 return <><header className="flex min-h-16 items-center justify-between gap-4 border-b bg-background px-5 py-3 sm:px-8"><p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]} <span className="mx-2 opacity-40">/</span>My tickets</p><UserNotifications/></header><PortalTicketList data={data as PortalWorkspaceData} filters={filters} team={ROLE_LABELS[user.role]} userId={user.id} submitted={submitted}/></>;
}
