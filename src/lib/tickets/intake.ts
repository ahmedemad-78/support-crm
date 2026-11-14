import { ATTACHMENT_RULES } from "./constants";
import { SCHOOL_CONTEXT_LABELS } from "./school-context";
import type { SupportTicketInput } from "./schema";
export type IntakeField = keyof SupportTicketInput;
export type IntakeDraft = Record<IntakeField, string>;
export const INTAKE_LABELS: Record<IntakeField, string> = { ...SCHOOL_CONTEXT_LABELS, reporter_id: "Reported by", contact_channel: "Contact channel", linked_ticket_id: "Related case", source: "Source", customer_name: "Customer full name", customer_email: "Contact email", customer_phone: "Contact phone", school_name: "School name", credentials_username: "Account identifier (email or phone number)", issue_date: "Reported on", city_id: "City", end_user_type: "Customer type", platform: "App platform", is_latest_version: "Using the latest app version?", fawry_payment: "Related to a Fawry payment?", app_version: "Installed app version", device_type: "Device model", page_screen: "Affected page or screen", steps: "Steps to reproduce", issue_description: "Issue description" };
export const CUSTOMER_FIELDS: IntakeField[] = ["customer_name", "end_user_type", "city_id"];
export const APP_FIELDS: IntakeField[] = ["platform", "is_latest_version", "fawry_payment"];
export function initialIntakeDraft(today: string, onlySource = ""): IntakeDraft {
  return { school_code:"",school_user_ids:"",school_issue_area:"",school_impact:"",school_expected_grade:"",school_shown_grade:"",school_subject:"",school_section:"", reporter_id: "", contact_channel: "unspecified", linked_ticket_id: "", source: onlySource, customer_name: "", customer_email: "", customer_phone: "", school_name: "", credentials_username: "", issue_date: today, city_id: "", end_user_type: "", platform: "", is_latest_version: "", fawry_payment: "", app_version: "", device_type: "", page_screen: "", steps: "", issue_description: "" };
}
export type IntakeFile = { id: string; file: File; uploaded?: boolean };
type FileInfo = Pick<File, "name" | "size" | "type" | "lastModified">;
export function attachmentMime(file: Pick<File, "name" | "type">): string {
  if(file.type==="audio/x-m4a")return "audio/mp4";
  if(file.type==="audio/mp3")return "audio/mpeg";
  const ext = file.name.split(".").pop()?.toLowerCase();
  const documents: Record<string, string> = { mp3:"audio/mpeg", m4a:"audio/mp4", wav:"audio/wav", ogg:"audio/ogg", weba:"audio/webm", pdf: "application/pdf", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  if ((!file.type || file.type === "application/octet-stream") && ext && documents[ext]) return documents[ext];
  return file.type;
}
export function checkIntakeFiles(current: FileInfo[], incoming: FileInfo[]) {
  const accepted: FileInfo[] = [];
  const issues: string[] = [];
  for (const file of incoming) {
    const limit = ATTACHMENT_RULES.types[attachmentMime(file)];
    if (!limit) { issues.push(`${file.name}: use JPG, PNG, MP4, MOV, MP3, M4A, WAV, OGG, WEBA, PDF, XLS or XLSX.`); continue; }
    if (file.size <= 0) { issues.push(`${file.name}: the file is empty.`); continue; }
    if (file.size > limit) { issues.push(`${file.name}: images, audio and documents must be under 10 MB; videos under 50 MB.`); continue; }
    if ([...current, ...accepted].some((other) => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified)) { issues.push(`${file.name} is already attached.`); continue; }
    if (current.length + accepted.length >= ATTACHMENT_RULES.maxFiles) { issues.push("You can attach up to 5 files."); break; }
    accepted.push(file);
  }
  return { accepted, issues };
}
export type IntakeUploadTransport = {
  hasRecord: (path: string) => Promise<{ exists: boolean; failed: boolean }>;
  upload: (path: string, file: File) => Promise<{ ok: boolean; alreadyExists?: boolean }>;
  record: (path: string, file: File) => Promise<boolean>;
};
/** Paths survive retries; confirmed files are never uploaded a second time. */
export async function uploadIntakeFiles(ticketId: string, items: IntakeFile[], transport: IntakeUploadTransport): Promise<IntakeFile[]> {
  const failed: IntakeFile[] = [];
  for (const item of items) {
    const path = `${ticketId}/${item.id}-${item.file.name.replace(/[^\w.-]+/g, "_")}`;
    let uploaded = Boolean(item.uploaded);
    try {
      const existing = await transport.hasRecord(path);
      if (existing.failed) { failed.push(item); continue; }
      if (existing.exists) continue;
      if (!uploaded) {
        const result = await transport.upload(path, item.file);
        if (!result.ok && !result.alreadyExists) { failed.push(item); continue; }
        uploaded = true;
      }
      if (!await transport.record(path, item.file)) failed.push({ ...item, uploaded });
    } catch { failed.push({ ...item, uploaded }); }
  }
  return failed;
}
