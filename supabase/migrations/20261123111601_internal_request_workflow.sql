-- New workflow only. Existing tickets, policies and lifecycle functions are untouched.
create table public.departments (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 2 and 120),
 is_active boolean not null default true, allow_external boolean not null default false,
 external_source_code text references public.ticket_sources(code),
 created_at timestamptz not null default now(),
 check(not allow_external or external_source_code is not null)
);
create unique index departments_name_key on public.departments(lower(name));
create table public.department_memberships(
 profile_id uuid primary key references public.profiles(id), department_id uuid not null references public.departments(id)
);
create index memberships_department_idx on public.department_memberships(department_id);
create function private.work_staff() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(private.current_role()='support_agent',false)
$$;
create function private.work_department() returns uuid language sql stable security definer set search_path='' as $$
 select m.department_id from public.department_memberships m join public.departments d on d.id=m.department_id and d.is_active
 where m.profile_id=auth.uid() and private.current_role() is not null
$$;
create function private.work_active() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.current_role() is not null
$$;
revoke all on function private.work_staff(),private.work_department(),private.work_active() from public,anon;
grant execute on function private.work_staff(),private.work_department(),private.work_active() to authenticated;

create table public.work_tickets(
 id uuid primary key default gen_random_uuid(), seq bigint generated always as identity unique,
 ticket_number text generated always as ('WRK-'||lpad(seq::text,7,'0')) stored unique,
 domain text not null check(domain in('internal','external')),
 kind text not null check(kind in('problem','execution_request')),
 title text not null check(length(btrim(title)) between 1 and 200),
 description text not null check(length(btrim(description)) between 1 and 8000),
 department_id uuid not null references public.departments(id),
 owner_id uuid not null references public.profiles(id), recorded_by_id uuid not null references public.profiles(id),
 source_code text references public.ticket_sources(code), external_data jsonb not null default '{}'::jsonb,
 optional_details jsonb not null default '{}'::jsonb,
 state text not null default 'new' check(state in('new','available','assigned_pending','in_progress','awaiting_owner','resolved','cancelled','closed_no_response')),
 current_worker_id uuid references public.profiles(id), pending_worker_id uuid references public.profiles(id), last_worker_id uuid references public.profiles(id),
 first_started_at timestamptz, reopen_count integer not null default 0 check(reopen_count>=0),
 revision bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 closed_at timestamptz,
 check((state in('in_progress','awaiting_owner'))=(current_worker_id is not null)),
 check((state='assigned_pending')=(pending_worker_id is not null)),
 check(domain='external' or (source_code is null and external_data='{}'::jsonb)),
 check(jsonb_typeof(external_data)='object' and jsonb_typeof(optional_details)='object')
);
create index work_ticket_department_idx on public.work_tickets(department_id,created_at desc);
create index work_ticket_owner_idx on public.work_tickets(owner_id,created_at desc);
create index work_ticket_worker_idx on public.work_tickets(current_worker_id) where current_worker_id is not null;
create index work_ticket_pending_idx on public.work_tickets(pending_worker_id) where pending_worker_id is not null;
create index work_ticket_state_idx on public.work_tickets(state,updated_at desc);

create function private.work_can_read(p_ticket uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.work_active() and exists(select 1 from public.work_tickets t where t.id=p_ticket and
 (private.work_staff() or private.current_role()='manager' or t.owner_id=auth.uid() or t.department_id=private.work_department()))
$$;
create function private.work_can_reply(p_ticket uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.work_active() and exists(select 1 from public.work_tickets t where t.id=p_ticket and
 (private.is_admin() or t.owner_id=auth.uid() or (private.work_staff() and t.current_worker_id=auth.uid())))
$$;
revoke all on function private.work_can_read(uuid),private.work_can_reply(uuid) from public,anon;
grant execute on function private.work_can_read(uuid),private.work_can_reply(uuid) to authenticated;

create table public.work_ticket_controls(
 ticket_id uuid primary key references public.work_tickets(id), priority text not null default 'normal' check(priority in('low','normal','high','urgent')), due_at timestamptz
);
create table public.work_ticket_events(
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.work_tickets(id),
 actor_id uuid not null references public.profiles(id),kind text not null,
 body text check(length(body)<=8000),visibility text not null default 'public' check(visibility in('public','internal')),
 from_state text,to_state text,created_at timestamptz not null default now()
);
create index work_events_ticket_idx on public.work_ticket_events(ticket_id,created_at,id);
create table public.work_ticket_segments(
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.work_tickets(id),
 worker_id uuid not null references public.profiles(id),kind text not null check(kind in('working','waiting')),
 started_at timestamptz not null default now(),ended_at timestamptz,check(ended_at is null or ended_at>=started_at)
);
create unique index work_one_open_segment on public.work_ticket_segments(ticket_id) where ended_at is null;
create index work_segments_worker_idx on public.work_ticket_segments(worker_id,started_at);
create table public.work_ticket_resolutions(
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.work_tickets(id),
 cycle integer not null,classification jsonb not null,response text not null,
 resolver_credit_id uuid not null references public.profiles(id),action_actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),unique(ticket_id,cycle)
);
create index work_resolution_actor_idx on public.work_ticket_resolutions(resolver_credit_id,created_at);
create table public.work_ticket_attachments(
 id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.work_tickets(id),
 event_id uuid not null references public.work_ticket_events(id),uploaded_by uuid not null references public.profiles(id),
 file_name text not null,storage_path text not null unique,mime_type text not null,size_bytes bigint not null check(size_bytes>0 and size_bytes<=52428800),
 created_at timestamptz not null default now()
);
create index work_attachment_event_idx on public.work_ticket_attachments(event_id);
create table public.work_notifications(
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id),
 ticket_id uuid not null references public.work_tickets(id),event_id uuid not null references public.work_ticket_events(id),
 summary text not null,read_at timestamptz,created_at timestamptz not null default now(),unique(event_id,recipient_id)
);
create index work_notifications_recipient_idx on public.work_notifications(recipient_id,created_at desc);
create table private.work_receipts(
 actor_id uuid not null references public.profiles(id),request_id uuid not null,request_data jsonb not null,result jsonb not null,
 primary key(actor_id,request_id)
);
create table public.work_audit_events(
 id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id),kind text not null,
 ticket_id uuid references public.work_tickets(id),data jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

-- Read grants and RLS. Mutations are allowed only through validated commands.
do $$declare name text;begin
 foreach name in array array['departments','department_memberships','work_tickets','work_ticket_controls','work_ticket_events','work_ticket_segments','work_ticket_resolutions','work_ticket_attachments','work_notifications','work_audit_events'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from anon,authenticated',name);
  execute format('grant select on public.%I to authenticated',name);
 end loop;
end $$;
alter table private.work_receipts enable row level security;
create policy departments_read on public.departments for select to authenticated using(private.work_active());
create policy membership_read on public.department_memberships for select to authenticated using(private.work_active() and (profile_id=auth.uid() or private.work_staff() or private.current_role()='manager'));
create policy work_ticket_read on public.work_tickets for select to authenticated using(private.work_can_read(id));
create policy work_controls_read on public.work_ticket_controls for select to authenticated using(private.work_staff());
create policy work_event_read on public.work_ticket_events for select to authenticated using(private.work_can_read(ticket_id) and (visibility='public' or private.work_staff()));
create policy work_segments_read on public.work_ticket_segments for select to authenticated using(private.is_admin() or private.current_role()='manager');
create policy work_resolution_read on public.work_ticket_resolutions for select to authenticated using(private.work_staff() or private.current_role()='manager');
create policy work_file_read on public.work_ticket_attachments for select to authenticated using(private.work_can_read(ticket_id) and exists(select 1 from public.work_ticket_events e where e.id=event_id));
create policy work_notice_read on public.work_notifications for select to authenticated using(private.work_active() and recipient_id=auth.uid());
create policy work_audit_read on public.work_audit_events for select to authenticated using(private.is_admin());

create function private.work_name(who uuid) returns text language sql stable security definer set search_path='' as $$
 select p.full_name from public.profiles p where p.id=who and private.work_active() and
 (private.work_staff() or private.current_role()='manager' or who=auth.uid()
 or exists(select 1 from public.department_memberships m where m.profile_id=who and m.department_id=private.work_department())
 or exists(select 1 from public.work_tickets t where private.work_can_read(t.id) and who in(t.owner_id,t.recorded_by_id,t.current_worker_id,t.pending_worker_id))
 or exists(select 1 from public.work_ticket_events e where e.actor_id=who and private.work_can_read(e.ticket_id) and e.visibility='public'))
$$;
revoke all on function private.work_name(uuid) from public,anon;
grant execute on function private.work_name(uuid) to authenticated;

create view public.case_register_v2 with(security_invoker=true) as
 select t.id,'legacy'::text as generation,'external'::text as domain,null::text as kind,null::uuid as department_id,
 null::text as department_name,t.ticket_number,left(t.issue_description,200) as title,t.issue_description as description,
 t.status::text as state,coalesce(t.reporter_id,t.created_by) as owner_id,null::text as owner_name,
 t.assignee_id as worker_id,null::text as worker_name,t.source as source_code,t.customer_name,
 t.created_at,t.updated_at,t.reopen_count,
 concat_ws(' ',t.ticket_number,t.customer_name,t.issue_description,t.source) as search_text
 from public.tickets t
 union all
 select t.id,'new',t.domain,t.kind,t.department_id,d.name,t.ticket_number,t.title,t.description,t.state,
 t.owner_id,private.work_name(t.owner_id),coalesce(t.current_worker_id,t.pending_worker_id),
 private.work_name(coalesce(t.current_worker_id,t.pending_worker_id)),t.source_code,t.external_data->>'customer_name',
 t.created_at,t.updated_at,t.reopen_count,
 concat_ws(' ',t.ticket_number,t.title,t.description,d.name,private.work_name(t.owner_id))
 from public.work_tickets t join public.departments d on d.id=t.department_id;
revoke all on public.case_register_v2 from anon,authenticated;
grant select on public.case_register_v2 to authenticated;

create function private.work_event(p_ticket uuid,p_kind text,p_body text default null,p_visibility text default 'public',p_from text default null,p_previous_worker uuid default null)
 returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;t public.work_tickets;begin
 select * into t from public.work_tickets where id=p_ticket;
 insert into public.work_ticket_events(ticket_id,actor_id,kind,body,visibility,from_state,to_state)
 values(p_ticket,auth.uid(),p_kind,p_body,p_visibility,p_from,t.state) returning id into e;
 insert into public.work_audit_events(actor_id,kind,ticket_id,data) values(auth.uid(),p_kind,p_ticket,jsonb_build_object('event_id',e,'channel','web','state',t.state));
 if p_visibility='public' then
  insert into public.work_notifications(recipient_id,ticket_id,event_id,summary)
  select distinct p.id,p_ticket,e,left(t.ticket_number||' · '||p_kind||' · '||t.title,500)
  from public.profiles p where p.is_active and
  (case when p_kind='created' then p.role='support_agent'
   else p.id in(t.owner_id,t.current_worker_id,t.pending_worker_id,t.last_worker_id,p_previous_worker) end);
 end if;
 return e;
end $$;
revoke all on function private.work_event(uuid,text,text,text,text,uuid) from public,anon,authenticated;

create function private.work_classification(p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare k text;tab text;n text;answer jsonb:='{}';begin
 for k,tab in select * from (values('request_type_id','request_types'),('topic_id','topics'),('cause_id','tracker_causes'),('action_id','tracker_actions'),('outcome_id','outcomes')) v(k,tab) loop
  if coalesce(p->>k,'')!~'^[1-9][0-9]{0,14}$' then raise exception 'Complete all five classification fields';end if;
  execute format('select name from public.%I where id=$1 and is_active',tab) into n using (p->>k)::bigint;
  if n is null then raise exception 'Choose active classification options';end if;
  answer:=answer||jsonb_build_object(k,jsonb_build_object('id',(p->>k)::bigint,'name',n));
 end loop;return answer;
end $$;
revoke all on function private.work_classification(jsonb) from public,anon,authenticated;

create function private.work_command(p_operation text,p_ticket uuid,p_revision bigint,p_request uuid,p_data jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.work_tickets;before_state text;who uuid:=auth.uid();owner uuid;dept public.departments;target uuid;body text:=btrim(coalesce(p_data->>'body',''));
 event uuid;result jsonb;receipt private.work_receipts;args jsonb;payload jsonb;classification jsonb;now_at timestamptz:=clock_timestamp();finished boolean;credit uuid;previous_worker uuid;
begin
 if not private.work_active() then raise exception 'Active account required';end if;
 if p_request is null or p_ticket is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>65536 then raise exception 'Invalid operation';end if;
 args:=jsonb_build_object('operation',p_operation,'ticket',p_ticket,'revision',p_revision,'data',p_data);
 perform pg_advisory_xact_lock(hashtextextended(who::text||p_request::text,0));
 select * into receipt from private.work_receipts where actor_id=who and request_id=p_request;
 if found then if receipt.request_data<>args then raise exception 'Request id already used for different data';end if;return receipt.result;end if;

 if p_operation='create' then
  owner:=coalesce(nullif(p_data->>'owner_id','')::uuid,who);
  if owner<>who and not(private.is_admin() or (private.work_staff() and p_data->>'domain'='external')) then raise exception 'Only admin can create internal requests on behalf';end if;
  select d.* into dept from public.department_memberships m join public.departments d on d.id=m.department_id
  join public.profiles p on p.id=m.profile_id and p.is_active where m.profile_id=owner and d.is_active;
  if dept.id is null then raise exception 'An active department is required for the request owner';end if;
  if coalesce(p_data->>'domain','') not in('internal','external') or coalesce(p_data->>'kind','') not in('problem','execution_request') then raise exception 'Choose a valid domain and ticket kind';end if;
  payload:=coalesce(p_data->'external_data','{}'::jsonb);
  if p_data->>'domain'='external' then
   if not dept.allow_external or not exists(select 1 from public.ticket_sources s where s.code=dept.external_source_code and s.is_active) then raise exception 'This department cannot submit external cases';end if;
   if length(btrim(coalesce(payload->>'customer_name','')))<2 or coalesce(payload->>'issue_date','')='' or (payload->>'issue_date')::date>current_date
    or coalesce(payload->>'city_id','')!~'^[1-9][0-9]*$' or coalesce(payload->>'end_user_type','') not in('student','teacher','parent','other') or coalesce(payload->>'platform','') not in('web','android','ios','huawei') then raise exception 'Complete the external customer, date, city, user type and platform fields';end if;
   if not exists(select 1 from public.cities where id=(payload->>'city_id')::bigint and is_active) then raise exception 'Choose an active city';end if;
   if dept.external_source_code in('june_schools','business_development') and length(btrim(coalesce(payload->>'school_name','')))=0 then raise exception 'School name is required';end if;
   if dept.external_source_code='june_schools' and (coalesce(payload->>'school_issue_area','') not in('subscription','access','classes','grade','content','other')
    or coalesce(payload->>'school_update_requested','') not in('yes','no','unknown')) then raise exception 'Complete the June school issue and update fields';end if;
   if exists(select 1 from public.cities where id=(payload->>'city_id')::bigint and lower(name)='other') and length(btrim(coalesce(payload->>'city_other','')))<2 then raise exception 'Enter the city name';end if;
  else payload:='{}';end if;
  insert into public.work_tickets(id,domain,kind,title,description,department_id,owner_id,recorded_by_id,source_code,external_data,optional_details)
  values(p_ticket,p_data->>'domain',p_data->>'kind',btrim(p_data->>'title'),btrim(p_data->>'description'),dept.id,owner,who,
   case when p_data->>'domain'='external' then dept.external_source_code end,payload,coalesce(p_data->'optional_details','{}')) returning * into t;
  insert into public.work_ticket_controls(ticket_id) values(t.id);
  event:=private.work_event(t.id,'created');
 else
  select * into t from public.work_tickets where id=p_ticket for update;
  if t.id is null or not private.work_can_read(t.id) then raise exception 'Ticket is unavailable';end if;
  if p_revision is distinct from t.revision then raise exception 'Ticket changed. Refresh before retrying; your draft is retained';end if;
  before_state:=t.state;previous_worker:=coalesce(t.current_worker_id,t.pending_worker_id,t.last_worker_id);finished:=t.state in('resolved','cancelled','closed_no_response');
  if p_operation='reply' then
   if not private.work_can_reply(t.id) or length(body)<1 or length(body)>8000 then raise exception 'Only the owner or current worker can reply';end if;
   if t.state='awaiting_owner' and who=t.owner_id then
    update public.work_ticket_segments set ended_at=now_at where ticket_id=t.id and ended_at is null;
    insert into public.work_ticket_segments(ticket_id,worker_id,kind,started_at) values(t.id,t.current_worker_id,'working',now_at);
    t.state:='in_progress';
   end if;
  elsif p_operation='note' then
   if not private.work_staff() or not(private.is_admin() or t.current_worker_id=who) or length(body)<1 or length(body)>4000 then raise exception 'Only the current worker can add an internal note';end if;
  elsif p_operation='start' then
   if not private.work_staff() or not(t.state in('new','available') or (t.state='assigned_pending' and t.pending_worker_id=who)) then raise exception 'Another worker is responsible for this ticket';end if;
   t.current_worker_id:=who;t.pending_worker_id:=null;t.state:='in_progress';t.first_started_at:=coalesce(t.first_started_at,now_at);
   insert into public.work_ticket_segments(ticket_id,worker_id,kind,started_at) values(t.id,who,'working',now_at);
  elsif p_operation='controls' then
   if not private.work_staff() then raise exception 'Only the technical team can set priority and due date';end if;
   update public.work_ticket_controls set priority=p_data->>'priority',due_at=nullif(p_data->>'due_at','')::timestamptz where ticket_id=t.id;
  elsif p_operation='owner' then
   if not private.is_admin() then raise exception 'Only admin can change request ownership';end if;
   target:=nullif(p_data->>'owner_id','')::uuid;
   select d.* into dept from public.department_memberships m join public.departments d on d.id=m.department_id and d.is_active join public.profiles p on p.id=m.profile_id and p.is_active where m.profile_id=target;
   if dept.id is null or (t.domain='external' and (not dept.allow_external or dept.external_source_code is distinct from t.source_code)) then raise exception 'Choose an active owner from a compatible department';end if;
   if dept.id is distinct from t.department_id and p_data->>'confirm_department_id' is distinct from dept.id::text then raise exception 'Confirm the destination department explicitly';end if;
   t.owner_id:=target;t.department_id:=dept.id;
  elsif p_operation='reopen' then
   if not finished or not(who=t.owner_id or private.is_admin()) or length(body)<1 then raise exception 'Owner and a reason are required to reopen';end if;
   t.state:='available';t.current_worker_id:=null;t.pending_worker_id:=null;t.closed_at:=null;t.reopen_count:=t.reopen_count+1;
  elsif p_operation='cancel' and who=t.owner_id and t.first_started_at is null and not finished then
   if length(body)<1 then raise exception 'Cancellation reason is required';end if;
   t.state:='cancelled';t.current_worker_id:=null;t.pending_worker_id:=null;t.closed_at:=now_at;
  elsif p_operation in('wait','transfer','return','resolve','cancel','close_no_response') then
   if finished or not private.work_staff() or not(private.is_admin() or t.current_worker_id=who) then raise exception 'Only the current worker can perform this action';end if;
   if p_operation='wait' then
    if t.state<>'in_progress' or length(body)<1 then raise exception 'Write the information needed from the owner';end if;
    t.state:='awaiting_owner';
   elsif p_operation='transfer' then
    target:=nullif(p_data->>'worker_id','')::uuid;
    if target is null or target=t.current_worker_id or not exists(select 1 from public.profiles where id=target and is_active and role='support_agent') then raise exception 'Choose another active technical team member';end if;
    t.current_worker_id:=null;t.pending_worker_id:=target;t.state:='assigned_pending';
   elsif p_operation='return' then t.current_worker_id:=null;t.pending_worker_id:=null;t.state:='available';
   elsif p_operation='resolve' then
    credit:=coalesce(t.current_worker_id,case when private.is_admin() then nullif(p_data->>'resolver_credit_id','')::uuid end);
    if credit is null or not exists(select 1 from public.profiles where id=credit and is_active and role='support_agent') then raise exception 'A responsible technical team member is required';end if;
    if length(body)<5 then raise exception 'Write the solution or completed work (at least 5 characters)';end if;
    classification:=private.work_classification(p_data);
    insert into public.work_ticket_resolutions(ticket_id,cycle,classification,response,resolver_credit_id,action_actor_id)
     values(t.id,t.reopen_count,classification,body,credit,who);
    t.state:='resolved';t.current_worker_id:=null;t.pending_worker_id:=null;t.closed_at:=now_at;
   else
    if length(body)<1 then raise exception 'A closure reason is required';end if;
    t.state:=case when p_operation='cancel' then 'cancelled' else 'closed_no_response' end;
    t.current_worker_id:=null;t.pending_worker_id:=null;t.closed_at:=now_at;
   end if;
   update public.work_ticket_segments set ended_at=now_at where ticket_id=t.id and ended_at is null;
   if t.state='awaiting_owner' then insert into public.work_ticket_segments(ticket_id,worker_id,kind,started_at) values(t.id,t.current_worker_id,'waiting',now_at);end if;
  else raise exception 'Unsupported operation';end if;
  update public.work_tickets set state=t.state,current_worker_id=t.current_worker_id,pending_worker_id=t.pending_worker_id,
   owner_id=t.owner_id,department_id=t.department_id,first_started_at=t.first_started_at,closed_at=t.closed_at,
   reopen_count=t.reopen_count,last_worker_id=case when t.state in('resolved','cancelled','closed_no_response') then previous_worker else null end,
   revision=revision+1,updated_at=now_at where id=t.id returning * into t;
  event:=private.work_event(t.id,p_operation,case when p_operation='controls' then null else nullif(body,'') end,case when p_operation='note' then 'internal' else 'public' end,before_state,previous_worker);
 end if;
 result:=jsonb_build_object('id',t.id,'number',t.ticket_number,'revision',t.revision,'state',t.state,'event_id',event);
 insert into private.work_receipts values(who,p_request,args,result);
 return result;
end $$;
revoke all on function private.work_command(text,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function private.work_command(text,uuid,bigint,uuid,jsonb) to authenticated;
create function public.work_command(operation text,ticket uuid,revision bigint,request_id uuid,data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select private.work_command(operation,ticket,revision,request_id,data) $$;
revoke all on function public.work_command(text,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.work_command(text,uuid,bigint,uuid,jsonb) to authenticated;

-- New Auth accounts are inactive until the verified admin provisioning action completes.
-- Public signup, even if enabled at the provider, cannot create an active CRM account.
alter table public.profiles alter column is_active set default false;

create function private.work_admin(p_operation text,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare department uuid;person uuid;begin
 if not private.is_admin() then raise exception 'Admin access required';end if;
 if p_operation='department' then
  department:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  insert into public.departments(id,name,is_active,allow_external,external_source_code)
   values(department,btrim(p_data->>'name'),coalesce((p_data->>'is_active')::boolean,true),coalesce((p_data->>'allow_external')::boolean,false),nullif(p_data->>'external_source_code',''))
   on conflict(id) do update set name=excluded.name,is_active=excluded.is_active,allow_external=excluded.allow_external,external_source_code=excluded.external_source_code;
 elsif p_operation='membership' then
  department:=(p_data->>'department_id')::uuid;person:=(p_data->>'profile_id')::uuid;
  if not exists(select 1 from public.departments where id=department and is_active) or not exists(select 1 from public.profiles where id=person) then raise exception 'Choose an active department and existing account';end if;
  insert into public.department_memberships values(person,department) on conflict(profile_id) do update set department_id=excluded.department_id;
 elsif p_operation<>'account_changed' then raise exception 'Unsupported admin operation';end if;
 insert into public.work_audit_events(actor_id,kind,data) values(auth.uid(),p_operation,p_data-'password'-'secret'-'token');
end $$;
revoke all on function private.work_admin(text,jsonb) from public,anon;
grant execute on function private.work_admin(text,jsonb) to authenticated;
create function public.work_admin(operation text,data jsonb) returns void language sql security invoker set search_path='' as $$select private.work_admin(operation,data)$$;
revoke all on function public.work_admin(text,jsonb) from public,anon;
grant execute on function public.work_admin(text,jsonb) to authenticated;

create function private.work_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.work_active() then raise exception 'Active account required';end if;
 return jsonb_build_object(
 'department_id',private.work_department(),
 'departments',(select coalesce(jsonb_agg(to_jsonb(d) order by d.name),'[]') from public.departments d),
 'people',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'role',p.role,'department_id',m.department_id) order by p.full_name),'[]')
 from public.profiles p left join public.department_memberships m on m.profile_id=p.id where p.is_active and
 (private.work_staff() or private.current_role()='manager' or p.id=auth.uid() or m.department_id=private.work_department() or p.role='support_agent')));
end $$;
revoke all on function private.work_context() from public,anon;
grant execute on function private.work_context() to authenticated;
create function public.work_context() returns jsonb language sql security invoker set search_path='' as $$select private.work_context()$$;
revoke all on function public.work_context() from public,anon;
grant execute on function public.work_context() to authenticated;

create function public.work_read_notifications(ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not private.work_active() or coalesce(cardinality(ids),0)>500 then raise exception 'Invalid notification request';end if;
 update public.work_notifications set read_at=coalesce(read_at,now()) where id=any(ids) and recipient_id=auth.uid();
end $$;
grant update(read_at) on public.work_notifications to authenticated;
create policy work_notice_update on public.work_notifications for update to authenticated
 using(private.work_active() and recipient_id=auth.uid()) with check(private.work_active() and recipient_id=auth.uid());
revoke all on function public.work_read_notifications(uuid[]) from public,anon;
grant execute on function public.work_read_notifications(uuid[]) to authenticated;

create function private.work_performance(p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare as_of timestamptz:=now();begin
 if not private.work_active() or not(private.is_admin() or private.current_role()='manager') then raise exception 'Performance reports are for admin and managers only';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,
 'solved',(select count(distinct r.ticket_id) from public.work_ticket_resolutions r join public.work_tickets t on t.id=r.ticket_id and t.state='resolved' and t.reopen_count=r.cycle
 where r.resolver_credit_id=p.id and r.created_at>=coalesce(p_from,'-infinity') and r.created_at<coalesce(p_to,'infinity')),
 'participated',(select count(distinct s.ticket_id) from public.work_ticket_segments s where s.worker_id=p.id and s.started_at<coalesce(p_to,as_of) and coalesce(s.ended_at,as_of)>coalesce(p_from,'-infinity')),
 'working_seconds',(select coalesce(sum(extract(epoch from least(coalesce(s.ended_at,as_of),coalesce(p_to,as_of))-greatest(s.started_at,coalesce(p_from,s.started_at)))),0) from public.work_ticket_segments s where s.worker_id=p.id and s.kind='working' and s.started_at<coalesce(p_to,as_of) and coalesce(s.ended_at,as_of)>coalesce(p_from,'-infinity')),
 'waiting_seconds',(select coalesce(sum(extract(epoch from least(coalesce(s.ended_at,as_of),coalesce(p_to,as_of))-greatest(s.started_at,coalesce(p_from,s.started_at)))),0) from public.work_ticket_segments s where s.worker_id=p.id and s.kind='waiting' and s.started_at<coalesce(p_to,as_of) and coalesce(s.ended_at,as_of)>coalesce(p_from,'-infinity'))
 ) order by p.full_name),'[]') from public.profiles p where p.role='support_agent');
end $$;
revoke all on function private.work_performance(timestamptz,timestamptz) from public,anon;
grant execute on function private.work_performance(timestamptz,timestamptz) to authenticated;
create function public.work_performance(from_time timestamptz default null,to_time timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select private.work_performance(from_time,to_time)$$;
revoke all on function public.work_performance(timestamptz,timestamptz) from public,anon;
grant execute on function public.work_performance(timestamptz,timestamptz) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('work-ticket-attachments','work-ticket-attachments',false,52428800,array[
'image/jpeg','image/png','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm',
'application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
create policy work_storage_upload on storage.objects for insert to authenticated with check(
 bucket_id='work-ticket-attachments' and private.work_can_reply((storage.foldername(name))[1]::uuid));
create policy work_storage_read on storage.objects for select to authenticated using(
 bucket_id='work-ticket-attachments' and exists(select 1 from public.work_ticket_attachments a where a.storage_path=name));

create function private.work_files(p_ticket uuid,p_event uuid,p_files jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e public.work_ticket_events;f jsonb;obj storage.objects;total integer;begin
 if not private.work_can_reply(p_ticket) or jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)>5 then raise exception 'Attachment permission denied';end if;
 select * into e from public.work_ticket_events where id=p_event and ticket_id=p_ticket and actor_id=auth.uid();
 if e.id is null or e.kind not in('created','reply','note','wait','reopen') then raise exception 'Choose your own conversation event';end if;
 if e.kind='created' and (e.created_at<now()-interval '30 minutes' or exists(select 1 from public.work_tickets t where t.id=p_ticket and t.first_started_at is not null)) then raise exception 'Original request is immutable; add a new reply';end if;
 for f in select value from jsonb_array_elements(p_files) loop
  select * into obj from storage.objects where bucket_id='work-ticket-attachments' and name=f->>'path' and owner_id=auth.uid()::text;
  if obj.id is null or split_part(obj.name,'/',1)<>p_ticket::text or length(coalesce(f->>'name','')) not between 1 and 200
   or (obj.metadata->>'size')::bigint<=0 or (obj.metadata->>'size')::bigint>(case when obj.metadata->>'mimetype' like 'video/%' then 52428800 else 10485760 end) then raise exception 'Invalid uploaded attachment';end if;
  if exists(select 1 from public.work_ticket_attachments where storage_path=obj.name and (event_id<>p_event or uploaded_by<>auth.uid())) then raise exception 'Attachment already belongs to another event';end if;
  insert into public.work_ticket_attachments(ticket_id,event_id,uploaded_by,file_name,storage_path,mime_type,size_bytes)
   values(p_ticket,p_event,auth.uid(),f->>'name',obj.name,obj.metadata->>'mimetype',(obj.metadata->>'size')::bigint) on conflict(storage_path) do nothing;
 end loop;
 select count(*) into total from public.work_ticket_attachments where event_id=p_event;
 if total>5 then raise exception 'Up to five attachments per message';end if;
end $$;
revoke all on function private.work_files(uuid,uuid,jsonb) from public,anon;
grant execute on function private.work_files(uuid,uuid,jsonb) to authenticated;
create function public.work_files(ticket uuid,event uuid,files jsonb) returns void language sql security invoker set search_path='' as $$select private.work_files(ticket,event,files)$$;
revoke all on function public.work_files(uuid,uuid,jsonb) from public,anon;
grant execute on function public.work_files(uuid,uuid,jsonb) to authenticated;

create function private.work_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=to_jsonb(new);begin
 insert into public.work_audit_events(actor_id,kind,data) values(auth.uid(),'admin_'||lower(tg_op),jsonb_build_object('table',tg_table_name,'record',coalesce(row_data->>'id',row_data->>'code',row_data->>'key',row_data->>'profile_id')));
 return new;
end $$;
revoke all on function private.work_audit_change() from public,anon,authenticated;
do $$declare tab text;begin
 foreach tab in array array['departments','department_memberships','profiles','ticket_sources','request_types','topics','tracker_causes','tracker_actions','outcomes','app_settings'] loop
 execute format('create trigger work_admin_audit after insert or update on public.%I for each row execute function private.work_audit_change()',tab);
 end loop;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.work_notifications;
 end if;
end $$;
