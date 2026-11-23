"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runWorkCommand } from "@/app/(app)/work/actions";
import {
  finishedWork,
  type WorkTicket,
  type WorkContext,
  type Catalogs,
  type WorkControls,
  type WorkCommandResult,
} from "@/lib/work/types";
import type { CurrentUser } from "@/lib/auth/roles";
import { checkIntakeFiles, type IntakeFile } from "@/lib/tickets/intake";
import { ATTACHMENT_RULES } from "@/lib/tickets/constants";
import { LocalAttachmentPreview } from "@/components/tickets/attachment-preview";
import { uploadWorkFiles } from "@/lib/work/upload";
type Operation =
  | "start"
  | "reply"
  | "note"
  | "wait"
  | "transfer"
  | "return"
  | "resolve"
  | "cancel"
  | "close_no_response"
  | "reopen"
  | "controls"
  | "owner";
export function WorkActions({
  ticket,
  context,
  catalogs,
  user,
  controls,
}: {
  ticket: WorkTicket;
  context: WorkContext;
  catalogs: Catalogs;
  user: CurrentUser;
  controls: WorkControls | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Operation>("reply");
  const [body, setBody] = useState("");
  const [worker, setWorker] = useState("");
  const [owner, setOwner] = useState("");
  const [confirmedDept, setConfirmedDept] = useState(false);
  const [classification, setClassification] = useState<Record<string, string>>(
    {},
  );
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [priority, setPriority] = useState(controls?.priority || "normal");
  const [due, setDue] = useState(
    controls?.due_at ? localDateTime(controls.due_at) : "",
  );
  const attempt = useRef<{
    operation: Operation;
    revision: number;
    requestId: string;
    data: Record<string, unknown>;
  } | null>(null);
  const saved = useRef<WorkCommandResult | null>(null);
  const [savedResult, setSavedResult] = useState<WorkCommandResult | null>(
    null,
  );
  const busy = useRef(false);
  const staff = user.role === "support_agent",
    mine = ticket.owner_id === user.id,
    current = ticket.current_worker_id === user.id,
    finished = finishedWork(ticket.state);
  const choices: { value: Operation; label: string }[] = [];
  if (
    staff &&
    (["new", "available"].includes(ticket.state) ||
      (ticket.state === "assigned_pending" &&
        ticket.pending_worker_id === user.id))
  )
    choices.push({ value: "start", label: "Start work" });
  if (
    mine ||
    current ||
    user.isAdmin ||
    (staff && finished && ticket.last_worker_id === user.id)
  )
    choices.push({ value: "reply", label: "Send public reply" });
  if (staff && (current || user.isAdmin)) {
    choices.push({ value: "note", label: "Add internal note" });
    if (!finished) {
      if (ticket.state === "in_progress")
        choices.push({ value: "wait", label: "Ask owner for information" });
      choices.push(
        {
          value: "resolve",
          label:
            ticket.kind === "execution_request"
              ? "Complete request & close"
              : "Resolve & close",
        },
        { value: "transfer", label: "Transfer to a colleague" },
        { value: "return", label: "Return to team" },
        { value: "cancel", label: "Cancel with reason" },
        { value: "close_no_response", label: "Close — no response" },
      );
    }
  }
  if (
    mine &&
    !finished &&
    !ticket.first_started_at &&
    !choices.some((o) => o.value === "cancel")
  )
    choices.push({ value: "cancel", label: "Cancel with reason" });
  if ((mine || user.isAdmin) && finished)
    choices.push({ value: "reopen", label: "Reopen with reason" });
  if (user.isAdmin)
    choices.push({ value: "owner", label: "Change request owner" });
  const action = choices.some((o) => o.value === selected)
    ? selected
    : choices[0]?.value;
  const textNeeded =
    action &&
    [
      "reply",
      "note",
      "wait",
      "resolve",
      "cancel",
      "close_no_response",
      "reopen",
    ].includes(action);
  const canAttach =
    action && ["reply", "note", "wait", "reopen"].includes(action);
  const target = context.people.find((p) => p.id === owner);
  const targetDept = context.departments.find(
    (d) => d.id === target?.department_id,
  );
  const crossDept = targetDept && targetDept.id !== ticket.department_id;
  const fields = [
    ["request_type_id", "Request type", "request_types"],
    ["topic_id", "Topic", "topics"],
    [
      "cause_id",
      ticket.kind === "problem" ? "Problem cause" : "Request reason",
      "tracker_causes",
    ],
    ["action_id", "Action taken", "tracker_actions"],
    ["outcome_id", "Outcome", "outcomes"],
  ] as const;
  const execute = (
    operation: Operation,
    data: Record<string, unknown>,
    media: IntakeFile[] = [],
  ) => {
    if (busy.current) return;
    busy.current = true;
    setError("");
    start(async () => {
      try {
        let result = saved.current;
        if (!result) {
          attempt.current ??= {
            operation,
            revision: ticket.revision,
            requestId: crypto.randomUUID(),
            data,
          };
          const a = attempt.current;
          const response = await runWorkCommand({ ...a, ticket: ticket.id });
          if (!response.ok) {
            setError(response.error);
            if (!response.error.startsWith("Could not confirm"))
              attempt.current = null;
            return;
          }
          result = response.result;
          saved.current = result;
          setSavedResult(result);
        }
        const failed = await uploadWorkFiles(ticket.id, result.event_id, media);
        setFiles(failed);
        if (failed.length) {
          setError(
            "The action is saved; retry only the remaining attachments.",
          );
          return;
        }
        saved.current = null;
        setSavedResult(null);
        attempt.current = null;
        setBody("");
        setFiles([]);
        router.refresh();
      } catch {
        setError(
          saved.current
            ? "Action saved. Retry remaining attachments."
            : "Could not confirm the action. Retry the same request or refresh to inspect the history.",
        );
      } finally {
        busy.current = false;
      }
    });
  };
  return (
    <div className="work-grid">
      {choices.length > 0 ? (
        <section className="work-panel work-wide">
          <h2>Next action</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!action) return;
              execute(
                action,
                {
                  body,
                  ...classification,
                  ...(worker ? { worker_id: worker } : {}),
                  ...(owner ? { owner_id: owner } : {}),
                  ...(crossDept && confirmedDept
                    ? { confirm_department_id: targetDept.id }
                    : {}),
                },
                canAttach ? files : [],
              );
            }}
          >
            <fieldset
              disabled={pending || Boolean(savedResult)}
              className="work-grid"
            >
              <label className="work-field work-wide">
                Action
                <select
                  aria-label="Action"
                  value={action}
                  onChange={(e) => {
                    setSelected(e.target.value as Operation);
                    attempt.current = null;
                    setError("");
                  }}
                >
                  {choices.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {textNeeded && (
                <label className="work-field work-wide">
                  {action === "note"
                    ? "Internal note — technical team only"
                    : action === "resolve"
                      ? "Solution / completed work"
                      : action === "wait"
                        ? "Information needed from the owner"
                        : action === "reply"
                          ? "Public reply"
                          : "Reason"}{" "}
                  *
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    minLength={action === "resolve" ? 5 : 1}
                    maxLength={action === "note" ? 4000 : 8000}
                    dir="auto"
                  />
                </label>
              )}
              {action === "resolve" &&
                fields.map(([key, label, table]) => (
                  <label key={key} className="work-field">
                    {label} *
                    <select
                      aria-label={label + " *"}
                      value={classification[key] || ""}
                      onChange={(e) =>
                        setClassification((old) => ({
                          ...old,
                          [key]: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Choose…</option>
                      {catalogs[table].map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              {action === "resolve" &&
                !ticket.current_worker_id &&
                user.isAdmin && (
                  <label className="work-field">
                    Credit the solution to *
                    <select
                      aria-label="Credit the solution to *"
                      required
                      value={classification.resolver_credit_id || ""}
                      onChange={(e) =>
                        setClassification((old) => ({
                          ...old,
                          resolver_credit_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Choose worker…</option>
                      {context.people
                        .filter((p) => p.role === "support_agent")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              {action === "transfer" && (
                <label className="work-field">
                  Colleague *
                  <select
                    aria-label="Colleague *"
                    value={worker}
                    onChange={(e) => setWorker(e.target.value)}
                    required
                  >
                    <option value="">Choose…</option>
                    {context.people
                      .filter(
                        (p) =>
                          p.role === "support_agent" &&
                          p.id !== ticket.current_worker_id,
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <small>
                    The colleague’s time starts only after they press Start
                    work.
                  </small>
                </label>
              )}
              {action === "owner" && (
                <>
                  <label className="work-field">
                    New request owner *
                    <select
                      aria-label="New request owner *"
                      value={owner}
                      onChange={(e) => {
                        setOwner(e.target.value);
                        setConfirmedDept(false);
                      }}
                      required
                    >
                      <option value="">Choose…</option>
                      {context.people
                        .filter(
                          (p) => p.department_id && p.id !== ticket.owner_id,
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ·{" "}
                            {
                              context.departments.find(
                                (d) => d.id === p.department_id,
                              )?.name
                            }
                          </option>
                        ))}
                    </select>
                  </label>
                  {crossDept && (
                    <label className="work-check work-wide">
                      <input
                        type="checkbox"
                        checked={confirmedDept}
                        onChange={(e) => setConfirmedDept(e.target.checked)}
                        required
                      />
                      Move department visibility to {targetDept.name}.
                    </label>
                  )}
                </>
              )}
              {canAttach && (
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
                </label>
              )}
            </fieldset>
            {canAttach && files.length > 0 && (
              <div className="work-media">
                {files.map((f) => (
                  <LocalAttachmentPreview
                    key={f.id}
                    id={f.id}
                    file={f.file}
                    disabled={pending || Boolean(savedResult)}
                    remove={() =>
                      setFiles((old) => old.filter((x) => x.id !== f.id))
                    }
                  />
                ))}
              </div>
            )}
            <div className="work-actions">
              <button className="work-btn" disabled={pending}>
                {pending
                  ? "Saving…"
                  : savedResult
                    ? "Retry attachments"
                    : choices.find((c) => c.value === action)?.label}
              </button>
              <small className="work-muted">
                Original submitted details stay unchanged.
              </small>
            </div>
          </form>
        </section>
      ) : (
        <p className="work-notice work-wide">
          You can view this ticket. Actions are available to its owner and
          current worker.
        </p>
      )}
      {staff && controls && (
        <section className="work-panel work-wide">
          <h2>Team-only planning</h2>
          <form
            className="work-grid"
            onSubmit={(e) => {
              e.preventDefault();
              execute("controls", {
                priority,
                due_at: due ? new Date(due).toISOString() : "",
              });
            }}
          >
            <label className="work-field">
              Priority
              <select
                aria-label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {["low", "normal", "high", "urgent"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="work-field">
              Due date and time
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
              <small>Uses your device’s local timezone.</small>
            </label>
            <div>
              <button
                className="work-btn secondary"
                disabled={pending || Boolean(savedResult)}
              >
                Save planning
              </button>
            </div>
          </form>
        </section>
      )}
      {error && (
        <p role="alert" className="work-error work-wide">
          {error}
        </p>
      )}
    </div>
  );
}
function localDateTime(iso: string) {
  const d = new Date(iso);
  return (
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-") +
    "T" +
    [
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
    ].join(":")
  );
}
