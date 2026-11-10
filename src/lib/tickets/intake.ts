import { ATTACHMENT_RULES } from "./constants";
import type { SupportTicketInput } from "./schema";
export type IntakeField = keyof SupportTicketInput;
export type IntakeDraft = Record<IntakeField, string>;
export const INTAKE_LABELS: Record<IntakeField, string> = { contact_channel: "Contact channel", linked_ticket_id: "Related case", source: "Source", customer_name: "Customer name", customer_email: "Email", customer_phone: "Phone", school_name: "School", credentials_username: "Account username", issue_date: "Reported date", city_id: "City", end_user_type: "User type", platform: "Platform", is_latest_version: "Latest app version", fawry_payment: "Fawry payment", app_version: "App version", device_type: "Device", page_screen: "Page / screen", steps: "Steps to reproduce", issue_description: "Issue description" };
export const CUSTOMER_FIELDS: IntakeField[] = ["customer_name", "customer_email", "credentials_username", "end_user_type", "city_id"];
export const APP_FIELDS: IntakeField[] = ["platform", "is_latest_version", "fawry_payment"];
export function initialIntakeDraft(today: string, onlySource = ""): IntakeDraft {
  return { contact_channel: "unspecified", linked_ticket_id: "", source: onlySource, customer_name: "", customer_email: "", customer_phone: "", school_name: "", credentials_username: "", issue_date: today, city_id: "", end_user_type: "", platform: "", is_latest_version: "", fawry_payment: "", app_version: "", device_type: "", page_screen: "", steps: "", issue_description: "" };
}
export type IntakeFile = { id: string; file: File; uploaded?: boolean };
type FileInfo = Pick<File, "name" | "size" | "type" | "lastModified">;
export function checkIntakeFiles(current: FileInfo[], incoming: FileInfo[]) {
  const accepted: FileInfo[] = [];
  const issues: string[] = [];
  for (const file of incoming) {
    const limit = ATTACHMENT_RULES.types[file.type];
    if (!limit) { issues.push(`${file.name}: use JPG, PNG, MP4 or MOV.`); continue; }
    if (file.size > limit) { issues.push(`${file.name}: images must be under 10 MB and videos under 50 MB.`); continue; }
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
