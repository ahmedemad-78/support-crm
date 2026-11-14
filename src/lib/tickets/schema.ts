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
const rawTicketSchema = z.object({
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
  is_latest_version: z.string().optional().default(""),
  fawry_payment: yesNo("Fawry payment"),
  app_version: optionalText(20),
  device_type: optionalText(80),
  page_screen: optionalText(160),
  steps: optionalText(4000),
  school_code: optionalText(80),
  school_user_ids: optionalText(600),
  school_issue_area: optionalText(40),
  school_impact: optionalText(40),
  school_expected_grade: optionalText(80),
  school_shown_grade: optionalText(80),
  school_subject: optionalText(160),
  school_section: optionalText(80),
  issue_description: z.string().trim().min(5, "Describe the issue in a few words").max(8000,"Keep the description within 8,000 characters"),
});

export const SCHOOL_SOURCES = ["june_schools", "business_development"] as const;
export function needsSchool(source: string) { return SCHOOL_SOURCES.some(code => code === source); }
const hasSchool=(value:{school_name?:unknown})=>typeof value.school_name==="string"&&Boolean(value.school_name.trim());
const versionReady=(value:{platform?:unknown;is_latest_version?:unknown})=>value.platform==="web"||["yes","no","unknown"].includes(String(value.is_latest_version??""));
const versionRule={path:["is_latest_version"],message:"Choose Yes, No or Unknown for the latest app version",when:()=>true};
const schoolRule={path:["school_name"],message:"Enter the school name for this source",when:()=>true};
const normalizedLatest=(platform:string,value:string)=>platform==="web"||value==="unknown"?null:value==="yes";
export const portalTicketSchema=rawTicketSchema.refine(versionReady,versionRule).transform(value=>({...value,is_latest_version:normalizedLatest(value.platform,value.is_latest_version),app_version:value.platform==="web"?null:value.app_version}));
export function portalTicketSchemaFor(source:string){return rawTicketSchema.refine(value=>!needsSchool(source)||hasSchool(value),schoolRule).refine(versionReady,versionRule).transform(value=>({...value,is_latest_version:normalizedLatest(value.platform,value.is_latest_version),app_version:value.platform==="web"?null:value.app_version}));}
export const supportTicketSchema=rawTicketSchema.extend({
 source:z.string().trim().min(1,"Choose a source"),
 reporter_id:z.string().optional().transform(value=>value||null).pipe(z.uuid("Choose a reporting owner").nullable()),
}).refine(value=>!needsSchool(typeof value.source==="string"?value.source:"")||hasSchool(value),schoolRule).refine(versionReady,versionRule).transform(value=>({...value,is_latest_version:normalizedLatest(value.platform,value.is_latest_version),app_version:value.platform==="web"?null:value.app_version}));

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

/** Collect independent missing fields together, even when another enum is empty. */
export function intakeDraftErrors(value:Record<string,unknown>,source:string,support:boolean):PortalTicketFieldErrors{
 const parsed=(support?supportTicketSchema:portalTicketSchemaFor(source)).safeParse(value);
 const errors=parsed.success?{}:fieldErrorsOf(parsed.error);
 if(support&&!value.reporter_id)errors.reporter_id="Choose who reported this case.";
 return errors;
}
