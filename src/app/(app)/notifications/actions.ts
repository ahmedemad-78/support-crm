"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isPortalRole } from "@/lib/auth/roles";
import { z } from "zod";

export async function markTicketRepliesRead(ticketId:string,eventIds:string[]){
 const user=await getCurrentUser();
 if(!user||(!isPortalRole(user.role)&&user.role!=="support_agent"&&user.role!=="manager"))return {ok:false};
 const input=z.object({ticketId:z.uuid(),eventIds:z.array(z.uuid()).min(1).max(500)}).safeParse({ticketId,eventIds});
 if(!input.success)return {ok:false};
 try{
  const db=await createClient();
  const {error}=await db.from("notifications").update({read_at:new Date().toISOString()})
    .eq("recipient_id",user.id).eq("ticket_id",input.data.ticketId).in("event_id",input.data.eventIds).is("read_at",null);
  if(error)return {ok:false};
  revalidatePath("/tickets");
  revalidatePath("/portal/my-tickets");revalidatePath(`/portal/my-tickets/${ticketId}`);
  return {ok:true};
 }catch{return {ok:false};}
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", user.id)
    .is("read_at", null);
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}
