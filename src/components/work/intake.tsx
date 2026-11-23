"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkTicket } from "@/app/(app)/work/actions";
import { checkIntakeFiles, type IntakeFile } from "@/lib/tickets/intake";
import {
  ATTACHMENT_RULES,
  END_USER_TYPES,
  END_USER_TYPE_LABELS,
  PLATFORMS,
  PLATFORM_LABELS,
  sourceLabel,
} from "@/lib/tickets/constants";
import {
  SCHOOL_ISSUE_AREAS,
  SCHOOL_UPDATE_REQUESTED,
} from "@/lib/tickets/school-context";
import { LocalAttachmentPreview } from "@/components/tickets/attachment-preview";
import { uploadWorkFiles } from "@/lib/work/upload";
import type { WorkContext, WorkCommandResult } from "@/lib/work/types";
import type { CurrentUser } from "@/lib/auth/roles";
export function WorkIntake({
  user,
  context,
  cities,
  today,
}: {
  user: CurrentUser;
  context: WorkContext;
  cities: { id: number; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState<"internal" | "external">("internal");
  const [kind, setKind] = useState<"problem" | "execution_request">("problem");
  const [owner, setOwner] = useState(user.id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [external, setExternal] = useState<Record<string, string>>({
    issue_date: today,
  });
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const operation = useRef<{ id: string; requestId: string } | null>(null);
  const saved = useRef<WorkCommandResult | null>(null);
  const [savedTicket, setSavedTicket] = useState<WorkCommandResult | null>(
    null,
  );
  const busy = useRef(false);
  const person = context.people.find((p) => p.id === owner);
  const department = context.departments.find(
    (d) => d.id === person?.department_id,
  );
  const source = department?.external_source_code || "";
  const school = ["june_schools", "business_development"].includes(source);
  const canOnBehalf =
    user.isAdmin || (user.role === "support_agent" && domain === "external");
  const set = (key: string, value: string) =>
    setExternal((old) => ({ ...old, [key]: value }));
  const field = (
    name: string,
    label: string,
    required = false,
    type = "text",
  ) => (
    <label className="work-field" key={name}>
      {label}
      {required ? " *" : " (optional)"}
      <input
        name={name}
        type={type}
        value={external[name] || ""}
        onChange={(e) => set(name, e.target.value)}
        required={required}
        dir="auto"
        maxLength={name === "steps" ? 4000 : 200}
      />
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: readonly { value: string; label: string }[],
    required = true,
  ) => (
    <label className="work-field" key={name}>
      {label}
      {required ? " *" : ""}
      <select
        aria-label={label + (required ? " *" : "")}
        name={name}
        value={external[name] || ""}
        onChange={(e) => set(name, e.target.value)}
        required={required}
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="work-page">
      <form
        className="work-panel"
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          if (busy.current) return;
          busy.current = true;
          setError("");
          start(async () => {
            try {
              let result = saved.current;
              if (!result) {
                operation.current ??= {
                  id: crypto.randomUUID(),
                  requestId: crypto.randomUUID(),
                };
                const response = await createWorkTicket({
                  ...operation.current,
                  domain,
                  kind,
                  title:
                    domain === "external"
                      ? description.trim().slice(0, 200)
                      : title,
                  description,
                  ownerId: owner,
                  external,
                  details,
                });
                if (!response.ok) {
                  setError(response.error);
                  return;
                }
                result = response.result;
                saved.current = result;
                setSavedTicket(result);
              }
              const failed = await uploadWorkFiles(
                result.id,
                result.event_id,
                files,
              );
              setFiles(failed);
              if (failed.length) {
                setError(
                  "Ticket " +
                    result.number +
                    " is saved. Retry the remaining attachments or open the saved ticket.",
                );
                return;
              }
              router.push("/work/" + result.id);
              router.refresh();
            } catch {
              setError(
                saved.current
                  ? "Ticket saved. Retry the remaining uploads or open it below."
                  : "Could not confirm the save. Your draft is retained.",
              );
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        <fieldset disabled={pending || Boolean(savedTicket)}>
          <legend className="work-original">New ticket</legend>
          <div
            className="work-choice"
            role="group"
            aria-label="Ticket audience"
          >
            <label>
              <input
                type="radio"
                name="domain"
                checked={domain === "internal"}
                onChange={() => {
                  setDomain("internal");
                  if (!user.isAdmin) setOwner(user.id);
                }}
              />
              Internal
            </label>
            <label>
              <input
                type="radio"
                name="domain"
                checked={domain === "external"}
                disabled={
                  !department?.allow_external &&
                  !user.isAdmin &&
                  user.role !== "support_agent"
                }
                onChange={() => setDomain("external")}
              />
              External customer case
            </label>
          </div>
          <div className="work-choice" role="group" aria-label="Ticket kind">
            <label>
              <input
                type="radio"
                name="kind"
                checked={kind === "problem"}
                onChange={() => setKind("problem")}
              />
              Report a problem
            </label>
            <label>
              <input
                type="radio"
                name="kind"
                checked={kind === "execution_request"}
                onChange={() => setKind("execution_request")}
              />
              Request work
            </label>
          </div>
          {canOnBehalf && (
            <label className="work-field">
              Request owner
              <select
                aria-label="Request owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                {context.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ·{" "}
                    {context.departments.find((d) => d.id === p.department_id)
                      ?.name || "No department"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="work-notice">
            Owner: <strong>{person?.name || user.fullName}</strong> ·
            Department: <strong>{department?.name || "Not assigned"}</strong>
            {domain === "external" && (
              <>
                {" "}
                · Source:{" "}
                <strong>{sourceLabel(source) || "Not configured"}</strong>
              </>
            )}
          </p>
          {!department?.is_active && (
            <p className="work-error">
              An administrator needs to assign an active department before you
              can submit.
            </p>
          )}
          {domain === "external" && !department?.allow_external && (
            <p className="work-error">
              This owner’s department is not enabled for external customer
              cases.
            </p>
          )}
          <div className="work-grid" style={{ marginTop: 18 }}>
            {domain === "internal" && (
              <label className="work-field work-wide">
                Title *
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  dir="auto"
                />
              </label>
            )}
            <label className="work-field work-wide">
              {kind === "problem"
                ? "Describe the problem"
                : "Describe the requested work"}{" "}
              *
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={8000}
                dir="auto"
              />
            </label>
            {domain === "external" && (
              <>
                {field("customer_name", "Customer name", true)}
                {field("issue_date", "Reported on", true, "date")}
                <label className="work-field">
                  City *
                  <select
                    aria-label="City *"
                    value={external.city_id || ""}
                    onChange={(e) => set("city_id", e.target.value)}
                    required
                  >
                    <option value="">Choose…</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {cities
                  .find((c) => String(c.id) === external.city_id)
                  ?.name.toLowerCase() === "other" &&
                  field("city_other", "City / country name", true)}
                {select(
                  "end_user_type",
                  "Customer type",
                  END_USER_TYPES.map((value) => ({
                    value,
                    label: END_USER_TYPE_LABELS[value],
                  })),
                )}
                {select(
                  "platform",
                  "App platform",
                  PLATFORMS.map((value) => ({
                    value,
                    label: PLATFORM_LABELS[value],
                  })),
                )}
                {external.platform !== "web" &&
                  select("is_latest_version", "Using the latest app version?", [
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                    { value: "unknown", label: "Unknown" },
                  ])}
                {select("fawry_payment", "Related to a Fawry payment?", [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "unknown", label: "Unknown" },
                ])}
                {school && field("school_name", "School name", true)}
                {source === "june_schools" && (
                  <>
                    {select(
                      "school_issue_area",
                      "School issue area",
                      SCHOOL_ISSUE_AREAS,
                    )}
                    {select(
                      "school_update_requested",
                      "MySchool update already requested?",
                      SCHOOL_UPDATE_REQUESTED,
                    )}
                  </>
                )}
                {field("customer_email", "Contact email", false, "email")}
                {field("customer_phone", "Contact phone")}
                {field(
                  "credentials_username",
                  "Account identifier (email or phone)",
                )}
                {field("device_type", "Device")}
                {field("app_version", "App version")}
                {field("page_screen", "Page / screen")}
                {field("steps", "Steps to reproduce")}
              </>
            )}
            <label className="work-field work-wide">
              Additional account, school or technical details (optional)
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={4000}
                dir="auto"
              />
              <small>
                Use these details only when relevant. No account or school
                registry is created.
              </small>
            </label>
            <label className="work-field work-wide">
              Attachments (optional)
              <input
                type="file"
                multiple
                accept={ATTACHMENT_RULES.accept}
                onChange={(e) => {
                  const checked = checkIntakeFiles(
                    files.map((f) => f.file),
                    Array.from(e.target.files ?? []),
                  );
                  setFiles((old) => [
                    ...old,
                    ...(checked.accepted as File[]).map((file) => ({
                      id: crypto.randomUUID(),
                      file,
                    })),
                  ]);
                  if (checked.issues.length)
                    setError(checked.issues.join(" · "));
                  e.target.value = "";
                }}
              />
              <small>
                Up to 5 files. Images, audio and documents: 10 MB; video: 50 MB.
              </small>
            </label>
          </div>
        </fieldset>
        {!!files.length && (
          <div className="work-media">
            {files.map((item) => (
              <LocalAttachmentPreview
                key={item.id}
                id={item.id}
                file={item.file}
                disabled={pending || Boolean(savedTicket)}
                remove={() =>
                  setFiles((old) => old.filter((f) => f.id !== item.id))
                }
              />
            ))}
          </div>
        )}
        {error && (
          <p className="work-error" role="alert">
            {error}
          </p>
        )}
        <div className="work-actions">
          <button
            className="work-btn"
            disabled={
              pending ||
              !department?.is_active ||
              (domain === "external" && !department.allow_external)
            }
          >
            {pending
              ? "Saving…"
              : savedTicket
                ? "Retry attachments"
                : "Create ticket"}
          </button>
          <a
            className="work-btn secondary"
            href={savedTicket ? "/work/" + savedTicket.id : "/tickets"}
          >
            {savedTicket ? "Open saved ticket" : "Cancel"}
          </a>
        </div>
      </form>
    </div>
  );
}
