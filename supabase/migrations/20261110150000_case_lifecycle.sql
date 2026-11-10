-- Additive lifecycle. Existing tickets and old queued mail are not rewritten.
alter table public.ticket_sources add column default_reporter_id uuid references public.profiles(id);
update public.ticket_sources s set default_reporter_id=p.id from public.profiles p
where p.is_active and ((s.bound_role=p.role and s.bound_role is not null)
  or (s.code in ('whatsapp','google_play') and p.is_admin and p.role='support_agent' and p.full_name='Ahmed Emad'));

alter table public.tickets
  add column reporter_id uuid references public.profiles(id),
  add column contact_channel text not null default 'unspecified' check(contact_channel in ('unspecified','whatsapp','phone','email','form','google_play')),
  add column reopen_count integer not null default 0 check(reopen_count>=0),
  add column last_reopened_at timestamptz;
create index tickets_reporter_idx on public.tickets(reporter_id,created_at desc);

create table public.ticket_workflow_events (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets(id),
  actor_id uuid references public.profiles(id), kind text not null check(kind in ('created','status_changed','resolved','reopened','comment')),
  from_status public.ticket_status, to_status public.ticket_status, body text,
  resolution_snapshot jsonb, created_at timestamptz not null default now()
);
create index ticket_workflow_events_ticket_idx on public.ticket_workflow_events(ticket_id,created_at desc);
alter table public.ticket_workflow_events enable row level security;
create policy workflow_events_select on public.ticket_workflow_events for select to authenticated
using(exists(select 1 from public.tickets t where t.id=ticket_id));
grant select on public.ticket_workflow_events to authenticated;
-- Events can only be written by the guarded trigger / narrow authenticated RPC.
revoke insert,update,delete on public.ticket_workflow_events from anon,authenticated;

alter table public.notifications add column event_id uuid references public.ticket_workflow_events(id);
alter table public.email_outbox add column event_id uuid references public.ticket_workflow_events(id);
create unique index notifications_event_recipient_key on public.notifications(event_id,recipient_id) where event_id is not null;
create unique index email_outbox_event_recipient_key on public.email_outbox(event_id,to_address) where event_id is not null;
create function private.guard_notification_event() returns trigger language plpgsql set search_path='' as $$
begin
  if new.event_id is distinct from old.event_id then raise exception 'Notification event cannot be changed'; end if;
  return new;
end $$;
revoke all on function private.guard_notification_event() from public,anon,authenticated;
create trigger notifications_event_immutable before update on public.notifications for each row execute function private.guard_notification_event();
insert into public.app_settings(key,value) select 'workflow_notifications',jsonb_build_object(
  'mode','central_only','recipient_id',id,'email','ahmed.emad@selaheltelmeez.com')
from public.profiles where is_admin and role='support_agent' and full_name='Ahmed Emad';

create or replace function private.workflow_notice(t public.tickets,event uuid,title text,detail text)
returns void language plpgsql security definer set search_path='' as $$
declare cfg jsonb; recipient uuid; address text;
begin
  select value into cfg from public.app_settings where key='workflow_notifications';
  -- Fail closed: rollout never falls back to the original reporter's address.
  if cfg->>'mode' is distinct from 'central_only' then raise exception 'Notification routing is not configured'; end if;
  recipient := (cfg->>'recipient_id')::uuid; address:=cfg->>'email';
  if not exists(select 1 from public.profiles where id=recipient and role='support_agent' and is_active) or address is null then
    raise exception 'Central notification recipient is unavailable';
  end if;
  insert into public.notifications(recipient_id,ticket_id,ticket_number,kind,summary,status,event_id)
  values(recipient,t.id,t.ticket_number,case when title='New case' then 'new_ticket'::public.notification_kind else 'status_changed'::public.notification_kind end,
    left(title||' · '||coalesce(detail,''),500),t.status,event);
  insert into public.email_outbox(ticket_id,to_address,subject,body_text,ticket_path,event_id)
  values(t.id,address,t.ticket_number||' · '||title,
    'Source: '||t.source||E'\n\nProblem\n'||t.issue_description||E'\n\nUpdate\n'||coalesce(detail,''),'/tickets/'||t.id::text,event);
end $$;
revoke all on function private.workflow_notice(public.tickets,uuid,text,text) from public,anon,authenticated;

create or replace function private.workflow_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare reason text;
begin
  if tg_op='INSERT' then
    if auth.uid() is null then raise exception 'Sign in before opening a case'; end if;
    if private.current_role()='support_agent' then
      select default_reporter_id into new.reporter_id from public.ticket_sources where code=new.source;
    else
      new.reporter_id:=auth.uid();
    end if;
    if new.reporter_id is null or not exists(select 1 from public.profiles where id=new.reporter_id and is_active) then
      raise exception 'This source needs an active reporting owner';
    end if;
    new.reopen_count:=0; new.last_reopened_at:=null;
    if new.linked_ticket_id is not null and not exists(select 1 from public.tickets t where t.id=new.linked_ticket_id
      and (private.current_role()='support_agent' or coalesce(t.reporter_id,t.created_by)=auth.uid())) then
      raise exception 'Related case is unavailable';
    end if;
  else
    if old.status in ('resolved','closed') and new.status in ('resolved','closed') and new.status is distinct from old.status then
      raise exception 'Reopen the case before changing its final outcome';
    end if;
    if (new.reporter_id,new.contact_channel,new.reopen_count,new.last_reopened_at) is distinct from
       (old.reporter_id,old.contact_channel,old.reopen_count,old.last_reopened_at) then raise exception 'Workflow identity and counters are managed by the system'; end if;
    if new.status='resolved' and (old.status is distinct from new.status or new.resolution_notes is distinct from old.resolution_notes)
      and length(btrim(coalesce(new.resolution_notes,'')))<5 then raise exception 'Write a clear resolution before resolving and closing'; end if;
    if old.status in ('resolved','closed') and new.status in ('new','in_progress','awaiting_customer') then
      reason:=current_setting('app.reopen_reason',true);
      if length(btrim(coalesce(reason,'')))<5 then raise exception 'Use Reopen case and explain why the same problem continues'; end if;
      new.reopen_count:=old.reopen_count+1; new.last_reopened_at:=now();
    end if;
    if new.status='resolved' then new.closed_at:=coalesce(new.closed_at,now()); end if;
  end if;
  return new;
end $$;
revoke all on function private.workflow_guard() from public,anon,authenticated;
-- Defaults / existing validation execute first (Postgres trigger name ordering).
create trigger tickets_before_z_workflow before insert or update on public.tickets for each row execute function private.workflow_guard();

create or replace function private.fan_out_new_ticket() returns trigger language plpgsql security definer set search_path='' as $$
declare event uuid;
begin
  insert into public.ticket_workflow_events(ticket_id,actor_id,kind,to_status) values(new.id,auth.uid(),'created',new.status) returning id into event;
  perform private.workflow_notice(new,event,'New case',left(new.issue_description,500)); return new;
end $$;
create or replace function private.notify_status_change() returns trigger language plpgsql security definer set search_path='' as $$
declare event uuid; event_kind text; detail text; title text; snapshot jsonb;
begin
  if new.status is not distinct from old.status then return new; end if;
  event_kind:=case when old.status in ('resolved','closed') and new.status in ('new','in_progress','awaiting_customer') then 'reopened' when new.status='resolved' then 'resolved' else 'status_changed' end;
  title:=case event_kind when 'reopened' then 'Case reopened' when 'resolved' then 'Resolved & closed' else 'Status: '||new.status::text end;
  detail:=case when event_kind='reopened' then current_setting('app.reopen_reason',true) when event_kind='resolved' then new.resolution_notes else new.status::text end;
  if event_kind='resolved' then
    snapshot:=jsonb_build_object('response',new.resolution_notes,'action_taken',new.action_taken,
      'request_type',(select name from public.request_types where id=new.request_type_id),
      'topic',(select name from public.topics where id=new.topic_id),
      'cause',(select name from public.tracker_causes where id=new.tracker_cause_id),
      'action',(select name from public.tracker_actions where id=new.tracker_action_id),
      'outcome',(select name from public.outcomes where id=new.outcome_id));
    detail:=detail||E'\nCause: '||coalesce(snapshot->>'cause','')||E'\nAction: '||coalesce(snapshot->>'action','')||E'\nOutcome: '||coalesce(snapshot->>'outcome','');
  end if;
  insert into public.ticket_workflow_events(ticket_id,actor_id,kind,from_status,to_status,body,resolution_snapshot)
  values(new.id,auth.uid(),event_kind,old.status,new.status,detail,snapshot) returning id into event;
  perform private.workflow_notice(new,event,title,detail); return new;
end $$;

drop policy tickets_select on public.tickets;
create policy tickets_select on public.tickets for select to authenticated using(
  (select private.current_role()) in ('support_agent','manager') or coalesce(reporter_id,created_by)=(select auth.uid()));

-- Keep portal-linked cases, then validate ownership in workflow_guard instead of discarding the link.
do $$ begin
  execute replace(pg_get_functiondef('private.set_ticket_defaults()'::regprocedure),
    'new.linked_ticket_id := null;', '-- Related case ownership is validated by workflow_guard.');
end $$;

-- Portal users do not receive general UPDATE access. This function permits one atomic transition only.
create function private.reopen_case(case_id uuid,expected_version timestamptz,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tickets;
begin
  if auth.uid() is null or private.current_role() is null then raise exception 'Sign in to reopen a case'; end if;
  select * into t from public.tickets where id=case_id for update;
  if t.id is null or not (private.current_role()='support_agent' or (private.current_role() in ('moderation','call_center','june_schools','business_development') and coalesce(t.reporter_id,t.created_by)=auth.uid())) then raise exception 'This case is not available to reopen'; end if;
  if t.updated_at is distinct from expected_version then raise exception 'Case changed. Refresh before trying again'; end if;
  if t.status not in ('resolved','closed') then raise exception 'Only a finished case can be reopened'; end if;
  if length(btrim(reason))<5 or length(reason)>4000 or reason is null then raise exception 'Explain why the problem continues (5–4000 characters)'; end if;
  perform set_config('app.reopen_reason',btrim(reason),true);
  update public.tickets set status='in_progress' where id=case_id;
  perform set_config('app.reopen_reason','',true);
end $$;
revoke all on function private.reopen_case(uuid,timestamptz,text) from public,anon;
grant execute on function private.reopen_case(uuid,timestamptz,text) to authenticated;
create function public.reopen_case(case_id uuid,expected_version timestamptz,reason text) returns void
language sql security invoker set search_path='' as $$select private.reopen_case(case_id,expected_version,reason)$$;
revoke all on function public.reopen_case(uuid,timestamptz,text) from public,anon;
grant execute on function public.reopen_case(uuid,timestamptz,text) to authenticated;

create function private.comment_on_case(case_id uuid,body text,request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare t public.tickets; existing public.ticket_workflow_events;
begin
  if auth.uid() is null or private.current_role() is null then raise exception 'Sign in to comment'; end if;
  select * into t from public.tickets where id=case_id for update;
  if t.id is null or not (private.current_role()='support_agent' or (private.current_role() in ('moderation','call_center','june_schools','business_development') and coalesce(t.reporter_id,t.created_by)=auth.uid())) then raise exception 'This case is not available to comment'; end if;
  if request_id is null or body is null or length(btrim(body))<2 or length(body)>4000 then raise exception 'Write a comment (2–4000 characters)'; end if;
  select * into existing from public.ticket_workflow_events where id=request_id;
  if existing.id is not null then
    if existing.ticket_id=case_id and existing.actor_id=auth.uid() and existing.kind='comment' then return; end if;
    raise exception 'Start a new comment request';
  end if;
  insert into public.ticket_workflow_events(id,ticket_id,actor_id,kind,body) values(request_id,case_id,auth.uid(),'comment',btrim(body));
  perform private.workflow_notice(t,request_id,'New comment',btrim(body));
end $$;
revoke all on function private.comment_on_case(uuid,text,uuid) from public,anon;
grant execute on function private.comment_on_case(uuid,text,uuid) to authenticated;
create function public.comment_on_case(case_id uuid,body text,request_id uuid) returns void
language sql security invoker set search_path='' as $$select private.comment_on_case(case_id,body,request_id)$$;
revoke all on function public.comment_on_case(uuid,text,uuid) from public,anon;
grant execute on function public.comment_on_case(uuid,text,uuid) to authenticated;
