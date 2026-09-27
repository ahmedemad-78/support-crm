"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileImage, FileVideo, Lock, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  ATTACHMENT_RULES,
  ATTACHMENTS_BUCKET,
  END_USER_TYPE_LABELS,
  END_USER_TYPES,
  PLATFORM_LABELS,
  PLATFORMS,
} from "@/lib/tickets/constants";
import {
  fieldErrorsOf,
  portalTicketSchema,
  type PortalTicketFieldErrors,
  type PortalTicketInput,
} from "@/lib/tickets/schema";
import { createPortalTicket } from "./actions";

type City = { id: number; name: string };
type Field = keyof PortalTicketInput;

export function NewTicketForm({ cities }: { cities: City[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<PortalTicketFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();

  function readForm(): PortalTicketInput {
    const data = new FormData(formRef.current!);
    return Object.fromEntries(
      [...data.entries()].filter(([, v]) => typeof v === "string"),
    ) as unknown as PortalTicketInput;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = readForm();
    const check = portalTicketSchema.safeParse(input);
    if (!check.success) {
      setErrors(fieldErrorsOf(check.error));
      scrollToFirstError();
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await createPortalTicket(input);
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setFormError(result.error ?? "Please fix the highlighted fields.");
        scrollToFirstError();
        return;
      }

      const failed = await uploadAttachments(result.ticketId, files);
      if (failed.length) {
        toast.warning(`Ticket ${result.ticketNumber} was created, but ${failed.join(", ")} didn't upload.`);
      }
      router.push(`/portal/my-tickets?submitted=${encodeURIComponent(result.ticketNumber)}`);
    });
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const limit = ATTACHMENT_RULES.types[file.type];
      if (!limit) {
        toast.error(`${file.name}: only JPG, PNG, MP4 or MOV files are allowed.`);
      } else if (file.size > limit) {
        toast.error(`${file.name} is too large. Images up to 10 MB, videos up to 50 MB.`);
      } else if (next.length >= ATTACHMENT_RULES.maxFiles) {
        toast.error(`You can attach up to ${ATTACHMENT_RULES.maxFiles} files.`);
        break;
      } else {
        next.push(file);
      }
    }
    setFiles(next);
  }

  const err = (field: Field) => errors[field];

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5 px-4 py-6 sm:px-8">
      <Section title="1. Customer" hint="Who is having the problem.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <TextField name="customer_name" label="Name" error={err("customer_name")} />
          <TextField name="customer_email" label="Email" type="email" error={err("customer_email")} />
          <SelectField name="end_user_type" label="User type" error={err("end_user_type")}>
            {END_USER_TYPES.map((t) => (
              <option key={t} value={t}>
                {END_USER_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectField>
          <TextField
            name="credentials_username"
            label={
              <span className="flex items-center gap-1.5">
                <Lock className="size-3 text-muted-foreground" />
                User name (login)
              </span>
            }
            error={err("credentials_username")}
            autoComplete="off"
          />
          <TextField
            name="school_name"
            label="School name"
            optional
            placeholder="e.g. El Nasr Language School"
            error={err("school_name")}
          />
          <SelectField name="city_id" label="City" error={err("city_id")}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>

      <Section title="2. Device & app" hint="Helps Support reproduce the issue.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <ChoiceField
            name="platform"
            label="Platform"
            options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }))}
            error={err("platform")}
          />
          <TextField
            name="device_type"
            label="Device type"
            optional
            placeholder="e.g. Samsung A32, iPhone 12"
            error={err("device_type")}
          />
          <TextField name="app_version" label="App version number" optional placeholder="e.g. 4.2.1" error={err("app_version")} />
          <ChoiceField
            name="is_latest_version"
            label="On the latest version?"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            error={err("is_latest_version")}
          />
          <ChoiceField
            name="fawry_payment"
            label="Paid with Fawry?"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            error={err("fawry_payment")}
          />
        </div>
      </Section>

      <Section title="3. Issue" hint="What happened and where.">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <TextField name="issue_date" label="Date of issue" type="date" error={err("issue_date")} />
            <TextField
              name="page_screen"
              label="Page / screen"
              optional
              placeholder="e.g. Subscriptions → Payment status"
              error={err("page_screen")}
            />
          </div>
          <TextAreaField name="steps" label="Steps / scenario" optional error={err("steps")} />
          <TextAreaField name="issue_description" label="Issue description" error={err("issue_description")} />
        </div>
      </Section>

      <Section title="4. Attachments" hint="Optional. Up to 5 files.">
        <div className="flex flex-col gap-3">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="flex cursor-pointer items-center gap-3.5 rounded-lg border-2 border-dashed bg-muted px-5 py-4 transition-colors hover:border-brand-action hover:bg-brand-tint/40 has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <UploadCloud className="size-6 text-brand-action" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">Drop files here or browse</span>
              <span className="text-xs text-muted-foreground">JPG or PNG up to 10&nbsp;MB · MP4 or MOV up to 50&nbsp;MB</span>
            </span>
            <input
              type="file"
              multiple
              accept={ATTACHMENT_RULES.accept}
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="flex items-center gap-2.5 rounded-lg border px-3 py-2">
              {file.type.startsWith("video/") ? (
                <FileVideo className="size-4 text-muted-foreground" />
              ) : (
                <FileImage className="size-4 text-muted-foreground" />
              )}
              <span className="flex-1 text-[13px] font-medium">
                {file.name} · {formatSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                title={`Remove ${file.name}`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {formError && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="size-4" />
          {formError}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" size="lg" className="h-10 px-4" onClick={() => router.push("/portal/my-tickets")}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="h-10 px-5 font-semibold" disabled={pending}>
          {pending ? "Submitting…" : "Submit ticket"}
        </Button>
      </div>
    </form>
  );
}

async function uploadAttachments(ticketId: string, files: File[]): Promise<string[]> {
  if (!files.length) return [];
  const supabase = createClient();
  const failed: string[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^\w.-]+/g, "_");
    const path = `${ticketId}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type });
    if (upload.error) {
      failed.push(file.name);
      continue;
    }
    const { error } = await supabase.from("ticket_attachments").insert({
      ticket_id: ticketId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (error) failed.push(file.name);
  }
  return failed;
}

function scrollToFirstError() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>("[aria-invalid='true']");
    (field?.matches("input, textarea, select") ? field : field?.querySelector<HTMLElement>("input"))?.focus({ preventScroll: true });
    field?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
  });
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="form-section flex flex-col gap-5 rounded-2xl border bg-background p-5 xl:flex-row xl:gap-8 xl:p-6">
      <div className="flex shrink-0 flex-col gap-1 xl:w-[200px]">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-[13px] leading-5 text-muted-foreground">{hint}</p>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function FieldShell({
  label,
  optional,
  error,
  htmlFor,
  children,
}: {
  label: React.ReactNode;
  optional?: boolean;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px] font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

function TextField({
  name,
  label,
  error,
  optional,
  ...props
}: {
  name: Field;
  label: React.ReactNode;
  error?: string;
  optional?: boolean;
} & Omit<React.ComponentProps<"input">, "name">) {
  return (
    <FieldShell label={label} optional={optional} error={error} htmlFor={name}>
      <Input id={name} name={name} aria-invalid={Boolean(error)} className="h-10" {...props} />
    </FieldShell>
  );
}

function TextAreaField({
  name,
  label,
  error,
  optional,
}: {
  name: Field;
  label: string;
  error?: string;
  optional?: boolean;
}) {
  return (
    <FieldShell label={label} optional={optional} error={error} htmlFor={name}>
      <Textarea id={name} name={name} rows={3} aria-invalid={Boolean(error)} />
    </FieldShell>
  );
}

function SelectField({
  name,
  label,
  error,
  children,
}: {
  name: Field;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <FieldShell label={label} error={error} htmlFor={name}>
      <select
        id={name}
        name={name}
        defaultValue=""
        aria-invalid={Boolean(error)}
        className={cn(
          "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive",
        )}
      >
        <option value="" disabled>
          Select…
        </option>
        {children}
      </select>
    </FieldShell>
  );
}

function ChoiceField({
  name,
  label,
  options,
  error,
}: {
  name: Field;
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <FieldShell label={label} error={error}>
      <div
        role="radiogroup"
        aria-label={label}
        aria-invalid={Boolean(error)}
        className={cn("flex h-10 rounded-lg bg-muted p-[3px]", error && "ring-1 ring-destructive")}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className="flex flex-1 cursor-pointer items-center justify-center rounded-md text-[13px] font-medium text-muted-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-checked:border has-checked:bg-background has-checked:font-semibold has-checked:text-foreground"
          >
            <input type="radio" name={name} value={o.value} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </FieldShell>
  );
}
