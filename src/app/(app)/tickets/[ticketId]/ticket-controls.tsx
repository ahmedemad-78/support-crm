"use client";

import { useState } from "react";
import { updateTicketHeader } from "../actions";
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from "@/lib/tickets/constants";
import { SaveButton } from "@/components/tickets/save-button";

export function TicketControls({
  ticketId,
  ticketNumber,
  status,
  assigneeId,
  agents,
  returnTo = "",
  updatedAt,
}: {
  ticketId: string;
  ticketNumber: string;
  status: TicketStatus;
  assigneeId: string | null;
  agents: { id: string; full_name: string }[];
  returnTo?: string;
  updatedAt: string;
}) {
  const [current, setCurrent] = useState(status);

  return (
    <form action={updateTicketHeader} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="updatedAt" value={updatedAt} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <label className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm">
        <span className="text-muted-foreground">Assignee</span>
        <select
          name="assigneeId"
          defaultValue={assigneeId ?? ""}
          className="bg-transparent font-medium outline-none"
        >
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.full_name}</option>
          ))}
        </select>
      </label>
      <label className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm">
        <span className="text-muted-foreground">Status</span>
        <select
          name="status"
          value={current}
          onChange={(event) => {
            const next = event.target.value as TicketStatus;
            if (next === "closed" && !window.confirm(`Mark ${ticketNumber} as Closed - No Response? Tracker fields stay optional.`)) return;
            setCurrent(next);
          }}
          className="bg-transparent font-semibold outline-none"
        >
          {TICKET_STATUSES.map((item) => (
            <option key={item} value={item}>{STATUS_LABELS[item]}</option>
          ))}
        </select>
      </label>
      <SaveButton>Save status & owner</SaveButton>
    </form>
  );
}

export function CredentialsValue({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-sm">{shown ? value : "••••••••"}</span>
      <button type="button" onClick={() => setShown((open) => !open)} className="text-xs font-semibold text-brand-action">
        {shown ? "Hide" : "Show"}
      </button>
    </span>
  );
}

export function CopyTicketNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      }}
      className="text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
