"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENT_RULES } from "@/lib/tickets/constants";

export async function submitCaseFollowup(_previous: { error: string; success: string }, form: FormData) {
  const user = await getCurrentUser();
  if (!user || !["support_agent", "moderation", "call_center", "june_schools", "business_development"].includes(user.role)) return { error: "This account cannot send case follow-up.", success: "" };
  const parsed = z.object({ ticketId: z.uuid(), mode: z.enum(["comment", "reopen"]), body: z.string().trim().min(2).max(4000), requestId: z.uuid(), version: z.iso.datetime({ offset: true }) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check your message and refresh this case before trying again.", success: "" };
  const input = parsed.data;
  if (input.mode === "reopen" && input.body.length < 5) return { error: "Explain why this same problem continues (at least 5 characters).", success: "" };
  let files: unknown;
  try { files=JSON.parse(String(form.get("files")||"[]")); } catch { return {error:"Check your attachments before sending.",success:""}; }
  const checked=z.array(z.object({path:z.string().min(1).max(700),name:z.string().min(1).max(255),type:z.string(),size:z.number().int().positive()})).max(5).safeParse(files);
  if(!checked.success||checked.data.some(file=>!ATTACHMENT_RULES.types[file.type]||file.size>ATTACHMENT_RULES.types[file.type]))return {error:"Check attachment formats and sizes before sending.",success:""};
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("send_case_message", { case_id: input.ticketId, expected_version: input.version, message_mode:input.mode,message_body:input.body,request_id:input.requestId,files:checked.data });
    if (error) return { error: error.message, success: "" };
  } catch { return { error: "Could not confirm the update. Your message is still here. Refresh the activity before retrying.", success: "" }; }
  revalidatePath(`/tickets/${input.ticketId}`);
  revalidatePath(`/portal/my-tickets/${input.ticketId}`);
  revalidatePath("/tickets"); revalidatePath("/portal/my-tickets"); revalidatePath("/dashboard");
  return { error: "", success: input.mode === "reopen" ? "Case reopened. Support has been notified." : "Comment added. The case status is unchanged." };
}
