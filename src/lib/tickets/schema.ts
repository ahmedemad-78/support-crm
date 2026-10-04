import { z } from "zod";
import { END_USER_TYPES, PLATFORMS } from "./constants";

const required = (label: string) => z.string().trim().min(1, `${label} is required`);
const yesNo = (label: string) =>
  z.enum(["yes", "no"], { error: `Choose Yes or No for "${label}"` }).transform((v) => v === "yes");

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

function todayInCairo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

/** The Moderation / Call Center form (FRD §5). Same schema runs in the browser and in the server action. */
export const portalTicketSchema = z.object({
  customer_name: z.string().trim().min(2, "Name needs at least 2 characters"),
  customer_email: z.email("Email needs a domain — try name@example.com"),
  school_name: optionalText(160),
  credentials_username: required("User name"),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date of issue")
    .refine((d) => d <= todayInCairo(), "Date of issue can't be in the future"),
  city_id: z.coerce.number({ error: "Choose a city" }).int().positive("Choose a city"),
  end_user_type: z.enum(END_USER_TYPES, { error: "Choose the user type" }),
  platform: z.enum(PLATFORMS, { error: "Choose the platform" }),
  is_latest_version: yesNo("On the latest version?"),
  app_version: optionalText(20),
  device_type: optionalText(80),
  page_screen: optionalText(160),
  steps: optionalText(4000),
  issue_description: z.string().trim().min(5, "Describe the issue in a few words"),
});

export type PortalTicketInput = z.input<typeof portalTicketSchema>;
export type PortalTicketFieldErrors = Partial<Record<keyof PortalTicketInput, string>>;

export function fieldErrorsOf(error: z.ZodError): PortalTicketFieldErrors {
  const out: PortalTicketFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof PortalTicketInput;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
