-- New workflow access paths; no legacy data or lifecycle changes.
alter policy membership_read on public.department_memberships using(
 (select private.work_active()) and (profile_id=(select auth.uid()) or (select private.work_staff()) or (select private.current_role())='manager'));
create index departments_source_idx on public.departments(external_source_code);
create index work_audit_actor_idx on public.work_audit_events(actor_id,created_at desc);
create index work_audit_ticket_idx on public.work_audit_events(ticket_id,created_at desc);
create index work_notice_ticket_idx on public.work_notifications(ticket_id);
create index work_attachment_ticket_idx on public.work_ticket_attachments(ticket_id);
create index work_attachment_uploader_idx on public.work_ticket_attachments(uploaded_by);
create index work_event_actor_idx on public.work_ticket_events(actor_id);
create index work_resolution_action_actor_idx on public.work_ticket_resolutions(action_actor_id);
create index work_ticket_last_worker_idx on public.work_tickets(last_worker_id);
create index work_ticket_recorder_idx on public.work_tickets(recorded_by_id);
create index work_ticket_source_idx on public.work_tickets(source_code);
alter policy work_notice_read on public.work_notifications using(
 (select private.work_active()) and recipient_id=(select auth.uid()) and private.work_can_read(ticket_id));
alter policy work_notice_update on public.work_notifications using(
 (select private.work_active()) and recipient_id=(select auth.uid())) with check(
 (select private.work_active()) and recipient_id=(select auth.uid()));
