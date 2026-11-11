import { z } from "zod";
import { validDay } from "./analytics";
import { END_USER_TYPES, PLATFORMS } from "./constants";

const yesNo = (label: string) =>
  z.enum(["yes", "no", "unknown"], { error: `Choose Yes, No or Unknown for "${label}"` }).transform((v) => v === "unknown" ? null : v === "yes");

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

function todayInCairo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

/** The Moderation / Call Center form (FRD §5). Same schema runs in the browser and in the server action. */
export const portalTicketSchema = z.object({
  contact_channel: z.enum(["unspecified", "whatsapp", "phone", "email", "form", "google_play"]).optional().default("unspecified"),
  linked_ticket_id: z.string().trim().optional().transform(value => value || null).pipe(z.uuid().nullable()),
  customer_name: z.string().trim().min(2, "Name needs at least 2 characters"),
  customer_email: z.string().trim().optional().transform(value => value || null).pipe(z.email("Enter a valid email, or leave it blank").nullable()),
  customer_phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => value || null)
    .refine(
      (value) => value == null || /^\+?[0-9][0-9\s().-]{5,31}$/.test(value),
      "Enter the phone number, or leave it blank",
    ),
  school_name: optionalText(160),
  credentials_username: optionalText(160),
  issue_date: z
    .string()
    .refine(validDay, "Pick a real date")
    .refine((d) => d <= todayInCairo(), "Date of issue can't be in the future"),
  city_id: z.coerce.number({ error: "Choose a city" }).int().positive("Choose a city"),
  end_user_type: z.enum(END_USER_TYPES, { error: "Choose the user type" }),
  platform: z.enum(PLATFORMS, { error: "Choose the platform" }),
  is_latest_version: yesNo("On the latest version?"),
  fawry_payment: yesNo("Fawry payment"),
  app_version: optionalText(20),
  device_type: optionalText(80),
  page_screen: optionalText(160),
  steps: optionalText(4000),
  issue_description: z.string().trim().min(5, "Describe the issue in a few words"),
});

export const SCHOOL_SOURCES = ["june_schools", "business_development"] as const;
export function needsSchool(source: string) { return SCHOOL_SOURCES.some(code => code === source); }
function schoolCheck(source: string, school: string | null | undefined, ctx: z.RefinementCtx) {
  if (needsSchool(source) && !school?.trim()) ctx.addIssue({ code: "custom", path: ["school_name"], message: "School name is required for this source" });
}
export function portalTicketSchemaFor(source: string) {
  return portalTicketSchema.superRefine((value, ctx) => schoolCheck(source, value.school_name, ctx));
}
export const supportTicketSchema = portalTicketSchema.extend({
  source: z.string().trim().min(1, "Choose a source"),
  reporter_id: z.string().optional().transform(value=>value||null).pipe(z.uuid("Choose a reporting owner").nullable()),
}).superRefine((value, ctx) => schoolCheck(value.source, value.school_name, ctx));

export type PortalTicketInput = z.input<typeof portalTicketSchema>;
export type SupportTicketInput = z.input<typeof supportTicketSchema>;
export type PortalTicketFieldErrors = Partial<Record<keyof SupportTicketInput, string>>;

export function fieldErrorsOf(error: z.ZodError): PortalTicketFieldErrors {
  const out: PortalTicketFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof SupportTicketInput;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
