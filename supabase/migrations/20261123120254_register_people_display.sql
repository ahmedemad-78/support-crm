-- Preserve legacy lifecycle and RLS while showing the actual reporting account.
create or replace view public.case_register_v2 with(security_invoker=true) as
 select t.id,'legacy'::text as generation,'external'::text as domain,null::text as kind,null::uuid as department_id,
 null::text as department_name,t.ticket_number,left(t.issue_description,200) as title,t.issue_description as description,
 t.status::text as state,coalesce(t.reporter_id,t.created_by) as owner_id,private.work_name(coalesce(t.reporter_id,t.created_by)) as owner_name,
 t.assignee_id as worker_id,private.work_name(t.assignee_id) as worker_name,t.source as source_code,t.customer_name,
 t.created_at,t.updated_at,t.reopen_count,
 concat_ws(' ',t.ticket_number,t.customer_name,t.issue_description,t.source,private.work_name(coalesce(t.reporter_id,t.created_by))) as search_text
 from public.tickets t
 union all
 select t.id,'new',t.domain,t.kind,t.department_id,d.name,t.ticket_number,t.title,t.description,t.state,
 t.owner_id,private.work_name(t.owner_id),coalesce(t.current_worker_id,t.pending_worker_id),
 private.work_name(coalesce(t.current_worker_id,t.pending_worker_id)),t.source_code,t.external_data->>'customer_name',
 t.created_at,t.updated_at,t.reopen_count,
 concat_ws(' ',t.ticket_number,t.title,t.description,d.name,private.work_name(t.owner_id))
 from public.work_tickets t join public.departments d on d.id=t.department_id;
