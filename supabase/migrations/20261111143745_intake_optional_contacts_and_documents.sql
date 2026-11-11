-- Contact identifiers are optional; NULL app/payment answers mean Unknown.
-- Existing tickets and their historical contact channels are untouched.
alter table public.tickets drop constraint form_tickets_have_all_fields;
alter table public.tickets add constraint form_tickets_have_all_fields check (
  is_historical or coalesce(action_taken,'') like 'historical:%' or coalesce(action_taken,'') like 'tracker:%'
  or (issue_date is not null and city_id is not null and end_user_type is not null and platform is not null)
);

-- Runs after source defaults and workflow ownership. Applies to NEW rows only.
create function private.validate_ticket_intake() returns trigger language plpgsql set search_path='' as $$
begin
  new.contact_channel := 'unspecified';
  if new.issue_date is null or new.city_id is null or new.end_user_type is null or new.platform is null then
    raise exception 'Reported date, city, user type and platform are required';
  end if;
  if new.source in ('june_schools','business_development') and length(btrim(coalesce(new.school_name,'')))=0 then
    raise exception 'School name is required for this source';
  end if;
  return new;
end $$;
revoke all on function private.validate_ticket_intake() from public,anon,authenticated;
create trigger tickets_before_zz_intake before insert on public.tickets for each row execute function private.validate_ticket_intake();

update public.ticket_sources set name='Call Center' where code='call_center';

alter table public.ticket_attachments drop constraint ticket_attachments_mime_type_check;
alter table public.ticket_attachments add constraint ticket_attachments_mime_type_check check (mime_type in (
'image/jpeg','image/png','video/mp4','video/quicktime','application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
alter table public.ticket_attachments drop constraint ticket_attachments_check;
alter table public.ticket_attachments add constraint ticket_attachments_size_bytes_check check (
size_bytes>0 and size_bytes<=case when mime_type like 'video/%' then 52428800 else 10485760 end);
update storage.buckets set allowed_mime_types=array[
'image/jpeg','image/png','video/mp4','video/quicktime','application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
where id='ticket-attachments';
