alter table public.ticket_workflow_events
  add column sender_name text,
  add column is_automated boolean;
