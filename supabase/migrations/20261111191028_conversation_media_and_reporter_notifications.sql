-- Future events only. Existing tickets, history and queued mail are not rewritten.
-- Email is deferred until the final release; in-app routing is independent.
update public.app_settings set value=value||'{"email_enabled":false,"in_app_mode":"participants"}'::jsonb
where key='workflow_notifications';

create or replace function private.workflow_notice(t public.tickets,event uuid,title text,detail text)
returns void language plpgsql security definer set search_path='' as $$
declare cfg jsonb; recipient uuid; actor_role public.user_role;
begin
  select value into cfg from public.app_settings where key='workflow_notifications';
  select role into actor_role from public.profiles where id=auth.uid() and is_active;
  -- Support updates go to the reporting owner. Reporter activity goes to support.
  if actor_role='support_agent' and title<>'New case' then
    recipient:=coalesce(t.reporter_id,t.created_by);
  else
    recipient:=coalesce(t.assignee_id,(cfg->>'recipient_id')::uuid);
  end if;
  if recipient is distinct from auth.uid() and exists(select 1 from public.profiles where id=recipient and is_active) then
    insert into public.notifications(recipient_id,ticket_id,ticket_number,kind,summary,status,event_id)
    values(recipient,t.id,t.ticket_number,case when title='New case' then 'new_ticket'::public.notification_kind else 'status_changed'::public.notification_kind end,
      left(title||' · '||coalesce(detail,''),500),t.status,event);
  end if;
  -- No email jobs are created here. Final email rollout needs explicit recipient
  -- verification, event-id deduplication, delivery/retry testing and enablement.
end $$;
revoke all on function private.workflow_notice(public.tickets,uuid,text,text) from public,anon,authenticated;

-- Honour support's selected reporter, but never allow a cross-team/inactive owner.
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('private.workflow_guard()'::regprocedure);
  definition:=replace(definition,
    'select default_reporter_id into new.reporter_id from public.ticket_sources where code=new.source;',
    $replacement$
      new.reporter_id:=coalesce(new.reporter_id,(select default_reporter_id from public.ticket_sources where code=new.source and is_active));
      if not exists(select 1 from public.profiles p join public.ticket_sources s on s.code=new.source
        where p.id=new.reporter_id and p.is_active and s.is_active and p.role=coalesce(s.bound_role,'support_agent'::public.user_role)) then
        raise exception 'Choose an active reporting owner from the selected source team';
      end if;
    $replacement$);
  execute definition;
end $$;

alter table public.ticket_attachments add column event_id uuid references public.ticket_workflow_events(id);
create index ticket_attachments_event_idx on public.ticket_attachments(event_id) where event_id is not null;
alter table public.ticket_attachments drop constraint ticket_attachments_mime_type_check;
alter table public.ticket_attachments add constraint ticket_attachments_mime_type_check check (mime_type in (
'image/jpeg','image/png','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm',
'application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
update storage.buckets set allowed_mime_types=array[
'image/jpeg','image/png','video/mp4','video/quicktime','audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm',
'application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] where id='ticket-attachments';

create or replace function private.limit_ticket_attachments() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Serialize per ticket, including independent upload requests.
  perform 1 from public.tickets where id=new.ticket_id for update;
  if new.event_id is not null and not exists(select 1 from public.ticket_workflow_events e
      where e.id=new.event_id and e.ticket_id=new.ticket_id and e.actor_id=new.uploaded_by and e.kind in ('comment','reopened')) then
    raise exception 'Attachment does not belong to this message';
  end if;
  if (select count(*) from public.ticket_attachments where ticket_id=new.ticket_id and event_id is not distinct from new.event_id)>=5 then
    raise exception 'Attach up to 5 files to a case submission or message';
  end if;
  if new.event_id is null and array_length(string_to_array(new.storage_path,'/'),1)<>2 then
    raise exception 'Invalid case attachment path';
  end if;
  return new;
end $$;
revoke all on function private.limit_ticket_attachments() from public,anon,authenticated;

-- Intake writes remain restricted to the existing policy; conversation records
-- are created only by the atomic message RPC after checking actual storage data.
alter policy ticket_attachments_insert on public.ticket_attachments with check (
 event_id is null and uploaded_by=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and t.status<>'closed'
 and ((select private.current_role())='support_agent' or (t.created_by=(select auth.uid()) and t.created_at>now()-interval '30 minutes'))));

-- Chat paths: {ticket}/{actor}/{request}/{file}. Only actual participants can stage
-- a file; closed tickets still accept replies without automatically reopening.
create policy ticket_chat_files_insert on storage.objects for insert to authenticated with check (
 bucket_id='ticket-attachments' and array_length(string_to_array(name,'/'),1)=4
 and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.tickets t where t.id::text=(storage.foldername(name))[1]
 and ((select private.current_role())='support_agent' or ((select private.current_role()) in ('moderation','call_center','june_schools','business_development') and coalesce(t.reporter_id,t.created_by)=(select auth.uid())))));
-- Tighten the original intake policy to its two-segment namespace.
alter policy ticket_files_insert on storage.objects with check (
 bucket_id='ticket-attachments' and array_length(string_to_array(name,'/'),1)=2
 and exists(select 1 from public.tickets t where t.id::text=(storage.foldername(name))[1] and t.status<>'closed'
 and ((select private.current_role())='support_agent' or (t.created_by=(select auth.uid()) and t.created_at>now()-interval '30 minutes'))));
alter policy ticket_files_select on storage.objects using (
 bucket_id='ticket-attachments' and exists(select 1 from public.tickets t where t.id::text=(storage.foldername(name))[1])
 and (array_length(string_to_array(name,'/'),1)=2 or owner_id=(select auth.uid())::text
 or exists(select 1 from public.ticket_attachments a where a.storage_path=name and a.event_id is not null)));

-- A reopen submitted from the composer uses the request UUID for its event too.
do $$ begin
 execute replace(replace(pg_get_functiondef('private.notify_status_change()'::regprocedure),
 'insert into public.ticket_workflow_events(ticket_id,actor_id,kind,from_status,to_status,body,resolution_snapshot)',
 'insert into public.ticket_workflow_events(id,ticket_id,actor_id,kind,from_status,to_status,body,resolution_snapshot)'),
 'values(new.id,auth.uid(),event_kind,old.status,new.status,detail,snapshot)',
 'values(coalesce(nullif(current_setting(''app.message_event_id'',true),'''')::uuid,gen_random_uuid()),new.id,auth.uid(),event_kind,old.status,new.status,detail,snapshot)');
end $$;

create function private.send_case_message(case_id uuid,request_id uuid,message_mode text,message_body text,expected_version timestamptz,files jsonb default '[]')
returns void language plpgsql security definer set search_path='' as $$
declare t public.tickets; existing public.ticket_workflow_events; f jsonb; obj storage.objects; prefix text; file_count int;
begin
 if auth.uid() is null or private.current_role() is null then raise exception 'Sign in to reply'; end if;
 select * into t from public.tickets where id=case_id for update;
 if t.id is null or not (private.current_role()='support_agent' or (private.current_role() in ('moderation','call_center','june_schools','business_development') and coalesce(t.reporter_id,t.created_by)=auth.uid())) then
   raise exception 'This case is not available to reply'; end if;
 if request_id is null or message_mode not in ('comment','reopen') or message_mode is null or message_body is null
 or length(btrim(message_body))<(case when message_mode='reopen' then 5 else 2 end) or length(message_body)>4000 then raise exception 'Check your message before sending'; end if;
 if files is null or jsonb_typeof(files)<>'array' then raise exception 'Invalid attachments'; end if;
 file_count:=jsonb_array_length(files);
 if file_count>5 then raise exception 'Attach up to 5 files per message'; end if;
 select * into existing from public.ticket_workflow_events where id=request_id;
 if existing.id is not null then
   if existing.ticket_id<>case_id or existing.actor_id is distinct from auth.uid() or existing.kind<>(case when message_mode='reopen' then 'reopened' else 'comment' end)
      or existing.body is distinct from btrim(message_body) then raise exception 'Start a new message request'; end if;
   if file_count<>(select count(*) from public.ticket_attachments where event_id=request_id) or exists(
     select 1 from jsonb_array_elements(files) j where not exists(select 1 from public.ticket_attachments a where a.event_id=request_id
       and a.storage_path=j->>'path' and a.file_name=j->>'name' and a.mime_type=j->>'type' and a.size_bytes=(j->>'size')::bigint)) then raise exception 'Message already sent with different attachments'; end if;
   return;
 end if;
 prefix:=case_id::text||'/'||auth.uid()::text||'/'||request_id::text||'/';
 for f in select * from jsonb_array_elements(files) loop
   if left(f->>'path',length(prefix)) is distinct from prefix or array_length(string_to_array(f->>'path','/'),1)<>4
      or length(coalesce(f->>'name','')) not between 1 and 255 then raise exception 'Invalid message attachment'; end if;
   select * into obj from storage.objects where bucket_id='ticket-attachments' and name=f->>'path';
   if obj.id is null or obj.owner_id is distinct from auth.uid()::text or (obj.metadata->>'size')::bigint is distinct from (f->>'size')::bigint
      or obj.metadata->>'mimetype' is distinct from f->>'type' then raise exception 'Attachment upload is incomplete. Retry sending.'; end if;
 end loop;
 if message_mode='reopen' then
   perform set_config('app.message_event_id',request_id::text,true);
   perform private.reopen_case(case_id,expected_version,btrim(message_body));
   perform set_config('app.message_event_id','',true);
 else
   perform private.comment_on_case(case_id,btrim(message_body),request_id);
 end if;
 for f in select * from jsonb_array_elements(files) loop
   insert into public.ticket_attachments(ticket_id,event_id,uploaded_by,storage_path,file_name,mime_type,size_bytes)
   values(case_id,request_id,auth.uid(),f->>'path',f->>'name',f->>'type',(f->>'size')::bigint);
 end loop;
end $$;
revoke all on function private.send_case_message(uuid,uuid,text,text,timestamptz,jsonb) from public,anon;
grant execute on function private.send_case_message(uuid,uuid,text,text,timestamptz,jsonb) to authenticated;
create function public.send_case_message(case_id uuid,request_id uuid,message_mode text,message_body text,expected_version timestamptz,files jsonb default '[]')
returns void language sql security invoker set search_path='' as $$select private.send_case_message(case_id,request_id,message_mode,message_body,expected_version,files)$$;
revoke all on function public.send_case_message(uuid,uuid,text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.send_case_message(uuid,uuid,text,text,timestamptz,jsonb) to authenticated;
