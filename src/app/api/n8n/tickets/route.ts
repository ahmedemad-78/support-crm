import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, validN8nKey } from "@/lib/n8n/auth";

export async function GET(request: Request) {
  if (!validN8nKey(request)) return unauthorized();
  const params = new URL(request.url).searchParams;
  const limitValue = Number(params.get("limit") ?? "50");
  const after = params.get("created_after");
  const date = after ? z.iso.datetime({ offset: true }).safeParse(after) : null;
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100 || (date && !date.success)) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const db = createAdminClient();
  let query = db.from("tickets").select("id,customer_name,customer_phone,issue_description,source,created_by,created_at,status,ticket_attachments(file_name,storage_path,mime_type)")
    .eq("status", params.get("status") ?? "new").order("created_at", { ascending: false }).limit(limitValue);
  if (date?.success) query = query.gte("created_at", date.data);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Ticket service unavailable" }, { status: 503 });

  const tickets = await Promise.all((data ?? []).map(async ticket => {
    const files = ticket.ticket_attachments ?? [];
    const signed = files.length ? await db.storage.from("ticket-attachments").createSignedUrls(files.map(file => file.storage_path), 60 * 60) : { data: [] };
    return {
      id: ticket.id,
      conversation_id: ticket.id,
      customer_name: ticket.customer_name,
      customer_phone: ticket.customer_phone,
      subject: ticket.issue_description,
      message: ticket.issue_description,
      category: ticket.source,
      created_by: ticket.created_by,
      created_at: ticket.created_at,
      attachments: files.map((file, index) => ({ name: file.file_name, url: signed.data?.[index]?.signedUrl ?? null, type: file.mime_type })),
    };
  }));
  return NextResponse.json({ data: tickets }, { headers: { "Cache-Control": "private, no-store" } });
}
