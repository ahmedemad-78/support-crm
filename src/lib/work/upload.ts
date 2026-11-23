import { createClient } from "@/lib/supabase/client";
import {
  attachmentMime,
  uploadIntakeFiles,
  type IntakeFile,
} from "@/lib/tickets/intake";
export async function uploadWorkFiles(
  ticketId: string,
  eventId: string,
  items: IntakeFile[],
) {
  const db = createClient();
  return uploadIntakeFiles(ticketId, items, {
    hasRecord: async (path) => {
      const r = await db
        .from("work_ticket_attachments")
        .select("id")
        .eq("ticket_id", ticketId)
        .eq("event_id", eventId)
        .eq("storage_path", path)
        .maybeSingle();
      return { exists: Boolean(r.data), failed: Boolean(r.error) };
    },
    upload: async (path, file) => {
      const r = await db.storage
        .from("work-ticket-attachments")
        .upload(path, file, { contentType: attachmentMime(file) });
      return {
        ok: !r.error,
        alreadyExists:
          String((r.error as { statusCode?: string } | null)?.statusCode) ===
          "409",
      };
    },
    record: async (path, file) => {
      const r = await db.rpc("work_files", {
        ticket: ticketId,
        event: eventId,
        files: [{ path, name: file.name }],
      });
      return !r.error;
    },
  });
}
