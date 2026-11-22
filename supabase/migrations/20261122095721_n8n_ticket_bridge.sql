-- The operator enrolls one dedicated, non-admin Support profile after installation.
create table private.n8n_identity (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references public.profiles(id)
);
revoke all on private.n8n_identity from public, anon, authenticated;

create function public.is_n8n_support() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.n8n_identity i join public.profiles p on p.id=i.user_id
    where p.id=auth.uid() and p.is_active and not p.is_admin and p.role='support_agent')
$$;
revoke all on function public.is_n8n_support() from public, anon;
grant execute on function public.is_n8n_support() to authenticated;

create table public.n8n_ticket_outbox (
  event_id uuid primary key references public.ticket_workflow_events(id) on delete cascade,
  ticket_id uuid not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index n8n_outbox_order on public.n8n_ticket_outbox(created_at,event_id);
alter table public.n8n_ticket_outbox enable row level security;
revoke all on public.n8n_ticket_outbox from public, anon, authenticated;
grant select,delete on public.n8n_ticket_outbox to authenticated;
create policy n8n_read on public.n8n_ticket_outbox for select to authenticated using ((select public.is_n8n_support()));
create policy n8n_ack on public.n8n_ticket_outbox for delete to authenticated using ((select public.is_n8n_support()));

create function private.queue_n8n_ticket_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from private.n8n_identity)
    and (new.kind='created' or (new.kind in ('comment','reopened') and exists(
      select 1 from public.profiles where id=new.actor_id and role in ('call_center','moderation','business_development','june_schools')
    ))) then
    insert into public.n8n_ticket_outbox(event_id,ticket_id,kind) values(new.id,new.ticket_id,new.kind);
  end if;
  return new;
end $$;
revoke all on function private.queue_n8n_ticket_event() from public,anon,authenticated;
create trigger queue_n8n_ticket_event after insert on public.ticket_workflow_events
for each row execute function private.queue_n8n_ticket_event();

-- One transaction for version check, command receipt and lifecycle side effects.
create table public.n8n_ticket_commands (
  request_id uuid primary key, ticket_id uuid not null references public.tickets(id),
  operation text not null, payload jsonb not null
);
alter table public.n8n_ticket_commands enable row level security;
revoke all on public.n8n_ticket_commands from public,anon,authenticated;
grant select,insert on public.n8n_ticket_commands to authenticated;
create policy n8n_receipts_read on public.n8n_ticket_commands for select to authenticated using ((select public.is_n8n_support()));
create policy n8n_receipts_insert on public.n8n_ticket_commands for insert to authenticated with check ((select public.is_n8n_support()));

create function public.apply_n8n_command(case_id uuid, request_id uuid, expected_version timestamptz, operation text, payload jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare t public.tickets; receipt public.n8n_ticket_commands;
begin
  if not public.is_n8n_support() then raise insufficient_privilege; end if;
  select * into strict t from public.tickets where id=case_id for update;
  select * into receipt from public.n8n_ticket_commands r where r.request_id=apply_n8n_command.request_id;
  if found then
    if receipt.ticket_id=case_id and receipt.operation=operation and receipt.payload=payload then return; end if;
    raise exception 'Request ID already used' using errcode='40001';
  end if;
  if t.updated_at is distinct from expected_version then raise exception 'Case changed' using errcode='40001'; end if;
  if (select count(*) from public.ticket_workflow_events where ticket_id=case_id) is distinct from (payload->>'expectedEvents')::bigint
    or (select count(*) from public.ticket_attachments where ticket_id=case_id) is distinct from (payload->>'expectedFiles')::bigint then
    raise exception 'Case activity changed' using errcode='40001';
  end if;
  insert into public.n8n_ticket_commands values(request_id,case_id,operation,payload);
  if operation='messages' then
    perform public.send_case_message(case_id,request_id,'comment',payload->>'body',expected_version,'[]');
  elsif operation='resolve' then
    if t.status in ('resolved','closed') then raise exception 'Case already finished' using errcode='40001'; end if;
    update public.tickets set status='resolved', resolution_notes=payload->>'resolutionNotes',
      request_type_id=(payload->>'requestTypeId')::bigint,topic_id=(payload->>'topicId')::bigint,
      tracker_cause_id=(payload->>'trackerCauseId')::bigint,tracker_action_id=(payload->>'trackerActionId')::bigint,
      outcome_id=(payload->>'outcomeId')::bigint, tracker_notes=coalesce(payload->>'trackerNotes',tracker_notes),
      action_taken=coalesce(payload->>'actionTaken',action_taken) where id=case_id;
  else raise exception 'Unknown ticket command'; end if;
end $$;
revoke all on function public.apply_n8n_command(uuid,uuid,timestamptz,text,jsonb) from public,anon;
grant execute on function public.apply_n8n_command(uuid,uuid,timestamptz,text,jsonb) to authenticated;

