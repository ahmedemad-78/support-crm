-- Keep team-only planning updates (controls) internal and out of owner/public notifications.
-- Add optional date-range bounds to member ticket performance to match work_performance.
create or replace function private.work_command(p_operation text,p_ticket uuid,p_revision bigint,p_request uuid,p_data jsonb)
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
   perform private.validate_work_external(payload,p_data->>'description');
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
   if p_operation in('transfer','return') and t.state='assigned_pending' then raise exception 'Start work before transferring or returning this ticket';end if;
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
   reopen_count=t.reopen_count,last_worker_id=case when t.state in('resolved','cancelled','closed_no_response') then coalesce(previous_worker,credit) else null end,
   revision=revision+1,updated_at=now_at where id=t.id returning * into t;
  event:=private.work_event(t.id,p_operation,case when p_operation='controls' then null else nullif(body,'') end,case when p_operation in('note','controls') then 'internal' else 'public' end,before_state,previous_worker);
 end if;
 result:=jsonb_build_object('id',t.id,'number',t.ticket_number,'revision',t.revision,'state',t.state,'event_id',event);
 insert into private.work_receipts values(who,p_request,args,result);
 return result;
end $$;

-- Reclassify any prior controls events as internal and remove their public notifications.
delete from public.work_notifications
 where event_id in (select id from public.work_ticket_events where kind='controls');
update public.work_ticket_events
   set visibility='internal'
 where kind='controls' and visibility<>'internal';

-- Align member drilldown report with work_performance optional date bounds.
drop function if exists public.work_member_performance(uuid);
drop function if exists private.work_member_performance(uuid);

create function private.work_member_performance(p_member uuid,p_from timestamptz default null,p_to timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare as_of timestamptz:=now();
begin
 if not private.work_active() or not(private.is_admin() or private.current_role()='manager') then
  raise exception 'Performance reports are for admin and managers only';
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'number',t.ticket_number,'title',t.title,'state',t.state,
  'solved',exists(select 1 from public.work_ticket_resolutions r where r.ticket_id=t.id and r.resolver_credit_id=p_member and t.state='resolved' and r.cycle=t.reopen_count and r.created_at>=coalesce(p_from,'-infinity') and r.created_at<coalesce(p_to,'infinity')),
  'working_seconds',(select coalesce(sum(extract(epoch from least(coalesce(s.ended_at,as_of),coalesce(p_to,as_of))-greatest(s.started_at,coalesce(p_from,s.started_at)))),0) from public.work_ticket_segments s where s.ticket_id=t.id and s.worker_id=p_member and s.kind='working' and s.started_at<coalesce(p_to,as_of) and coalesce(s.ended_at,as_of)>coalesce(p_from,'-infinity')),
  'waiting_seconds',(select coalesce(sum(extract(epoch from least(coalesce(s.ended_at,as_of),coalesce(p_to,as_of))-greatest(s.started_at,coalesce(p_from,s.started_at)))),0) from public.work_ticket_segments s where s.ticket_id=t.id and s.worker_id=p_member and s.kind='waiting' and s.started_at<coalesce(p_to,as_of) and coalesce(s.ended_at,as_of)>coalesce(p_from,'-infinity'))
 ) order by t.updated_at desc,t.id),'[]') from public.work_tickets t where
  exists(select 1 from public.work_ticket_segments s where s.ticket_id=t.id and s.worker_id=p_member and s.started_at<coalesce(p_to,as_of) and coalesce(s.ended_at,as_of)>coalesce(p_from,'-infinity'))
  or exists(select 1 from public.work_ticket_resolutions r where r.ticket_id=t.id and r.resolver_credit_id=p_member and r.created_at>=coalesce(p_from,'-infinity') and r.created_at<coalesce(p_to,'infinity')));
end $$;
revoke all on function private.work_member_performance(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function private.work_member_performance(uuid,timestamptz,timestamptz) to authenticated;

create function public.work_member_performance(member uuid,from_time timestamptz default null,to_time timestamptz default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.work_member_performance(member,from_time,to_time)$$;
revoke all on function public.work_member_performance(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.work_member_performance(uuid,timestamptz,timestamptz) to authenticated;
