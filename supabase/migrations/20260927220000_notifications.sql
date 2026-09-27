-- In-app notifications and the email outbox.
-- New ticket: a bell for every active Technical Support user.
-- Status change: a bell and an email for the employee who opened the ticket.

create type public.notification_kind as enum ('new_ticket', 'status_changed');
create type public.outbox_status as enum ('pending', 'sent', 'failed');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id),
  ticket_id uuid not null references public.tickets (id),
  ticket_number text not null,
  kind public.notification_kind not null,
  summary text not null,
  status public.ticket_status not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id),
  to_address text not null,
  subject text not null,
  body_text text not null,
  ticket_path text not null,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index email_outbox_due_idx
  on public.email_outbox (next_attempt_at)
  where status = 'pending';

alter table public.notifications enable row level security;
alter table public.email_outbox enable row level security;

create policy "notifications_select" on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy "notifications_update" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function private.guard_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recipient_id is distinct from old.recipient_id
    or new.ticket_id is distinct from old.ticket_id
    or new.ticket_number is distinct from old.ticket_number
    or new.kind is distinct from old.kind
    or new.summary is distinct from old.summary
    or new.status is distinct from old.status
    or new.created_at is distinct from old.created_at
    or (old.read_at is not null and new.read_at is distinct from old.read_at)
    or new.read_at is null
  then
    raise exception 'A notification can only be marked read';
  end if;
  return new;
end;
$$;

create trigger notifications_before_update
  before update on public.notifications
  for each row execute function private.guard_notification_update();

create or replace function private.fan_out_new_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  summary text := left(btrim(new.issue_description), 180);
begin
  insert into public.notifications (recipient_id, ticket_id, ticket_number, kind, summary, status)
  select p.id, new.id, new.ticket_number, 'new_ticket', summary, 'new'
  from public.profiles p
  where p.role = 'support_agent' and p.is_active;
  return new;
end;
$$;

create trigger tickets_after_insert_notify
  after insert on public.tickets
  for each row execute function private.fan_out_new_ticket();

create or replace function private.notify_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_email text;
  summary text := left(btrim(new.issue_description), 500);
  status_label text := case new.status
    when 'new' then 'New'
    when 'in_progress' then 'In Progress'
    when 'awaiting_customer' then 'Awaiting Customer'
    when 'resolved' then 'Resolved'
    when 'closed' then 'Closed'
  end;
  ticket_path text;
begin
  if old.status is not distinct from new.status or new.created_by is null then
    return new;
  end if;

  insert into public.notifications (recipient_id, ticket_id, ticket_number, kind, summary, status)
  values (new.created_by, new.id, new.ticket_number, 'status_changed', summary, new.status);

  select p.email into creator_email
  from public.profiles p
  where p.id = new.created_by and p.is_active;

  if creator_email is null then
    return new;
  end if;

  select case p.role
    when 'moderation' then '/portal/my-tickets/' || new.id::text
    when 'call_center' then '/portal/my-tickets/' || new.id::text
    else '/tickets/' || new.id::text
  end into ticket_path
  from public.profiles p
  where p.id = new.created_by;

  insert into public.email_outbox (ticket_id, to_address, subject, body_text, ticket_path)
  values (
    new.id,
    creator_email,
    new.ticket_number || ' is now ' || status_label,
    summary,
    ticket_path
  );

  return new;
end;
$$;

create trigger tickets_after_status_notify
  after update of status on public.tickets
  for each row execute function private.notify_status_change();

revoke all on function private.guard_notification_update() from public;
revoke all on function private.fan_out_new_ticket() from public;
revoke all on function private.notify_status_change() from public;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    )
  then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
