import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, validN8nKey } from "@/lib/n8n/auth";

const payloadSchema = z.object({
  message: z.string().trim().min(2).max(4000),
  sender: z.enum(["AI Agent", "Support"]),
  conversation_type: z.literal("CASE CONVERSATION"),
  team: z.literal("Support & reporting team"),
  conversation_id: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!validN8nKey(request)) return unauthorized();
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.conversation_id && parsed.data.conversation_id !== id)) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  const db = createAdminClient();
  const requestId = crypto.randomUUID();
  const { data, error } = await db.rpc("n8n_post_case_message", {
    case_id: id,
    request_id: requestId,
    message_body: parsed.data.message,
    sender_name: parsed.data.sender,
  });
  if (error?.code === "P0002") return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (error) return NextResponse.json({ error: "Could not post message" }, { status: 503 });
  return NextResponse.json({ ok: true, message_id: data }, { headers: { "Cache-Control": "no-store" } });
}
