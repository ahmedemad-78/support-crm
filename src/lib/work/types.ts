export const WORK_STATES = [
  "new",
  "available",
  "assigned_pending",
  "in_progress",
  "awaiting_owner",
  "resolved",
  "cancelled",
  "closed_no_response",
] as const;
export type WorkState = (typeof WORK_STATES)[number];
export const WORK_STATE_LABELS: Record<WorkState, string> = {
  new: "New",
  available: "Available to team",
  assigned_pending: "Awaiting start",
  in_progress: "In progress",
  awaiting_owner: "Awaiting owner reply",
  resolved: "Resolved / completed",
  cancelled: "Cancelled",
  closed_no_response: "Closed — no response",
};
export const finishedWork = (state: string) =>
  ["resolved", "cancelled", "closed_no_response", "closed"].includes(state);
export type Department = {
  id: string;
  name: string;
  is_active: boolean;
  allow_external: boolean;
  external_source_code: string | null;
};
export type WorkPerson = {
  id: string;
  name: string;
  role: string;
  department_id: string | null;
};
export type WorkContext = {
  department_id: string | null;
  departments: Department[];
  people: WorkPerson[];
};
export type WorkTicket = {
  id: string;
  ticket_number: string;
  domain: "internal" | "external";
  kind: "problem" | "execution_request";
  title: string;
  description: string;
  department_id: string;
  owner_id: string;
  recorded_by_id: string;
  source_code: string | null;
  external_data: Record<string, unknown>;
  optional_details: Record<string, unknown>;
  state: WorkState;
  current_worker_id: string | null;
  pending_worker_id: string | null;
  last_worker_id: string | null;
  first_started_at: string | null;
  reopen_count: number;
  revision: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
export type RegisterRow = {
  id: string;
  generation: "legacy" | "new";
  domain: string;
  kind: string | null;
  department_id: string | null;
  department_name: string | null;
  ticket_number: string;
  title: string;
  description: string;
  state: string;
  owner_id: string;
  owner_name: string | null;
  worker_id: string | null;
  worker_name: string | null;
  source_code: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
  reopen_count: number;
};
export type WorkEvent = {
  id: string;
  actor_id: string;
  kind: string;
  body: string | null;
  visibility: string;
  from_state: string | null;
  to_state: string | null;
  created_at: string;
};
export type WorkFile = {
  id: string;
  event_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  url?: string | null;
};
export type WorkControls = { priority: string; due_at: string | null };
export type WorkResolution = {
  id: string;
  cycle: number;
  classification: Record<string, { id: number; name: string }>;
  response: string;
  resolver_credit_id: string;
  action_actor_id: string;
  created_at: string;
};
export type Catalogs = Record<
  | "request_types"
  | "topics"
  | "tracker_causes"
  | "tracker_actions"
  | "outcomes",
  { id: number; name: string; is_active: boolean }[]
>;
export type WorkCommandResult = {
  id: string;
  number: string;
  revision: number;
  state: WorkState;
  event_id: string;
};
