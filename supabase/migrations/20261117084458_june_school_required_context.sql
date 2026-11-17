-- 30 June cases need the same facts the form already requires, on every write path.
-- Existing rows already have these values, so the check validates the current table.

alter table public.tickets add constraint june_schools_have_context check (
  source <> 'june_schools'
  or (
    length(btrim(coalesce(school_name, ''))) > 0
    and school_context->>'school_issue_area' in ('subscription', 'access', 'classes', 'grade', 'content', 'other')
    and school_context->>'school_update_requested' in ('yes', 'no', 'unknown')
  )
);

comment on column public.tickets.school_context is
  '30 June intake facts. Issue type and MySchool update are required for that source. Protected by the existing ticket RLS policies.';

create or replace function private.validate_ticket_intake()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.contact_channel := 'unspecified';
  if new.issue_date is null or new.city_id is null or new.end_user_type is null or new.platform is null then
    raise exception 'Reported date, city, user type and platform are required';
  end if;
  if new.source in ('june_schools', 'business_development') and length(btrim(coalesce(new.school_name, ''))) = 0 then
    raise exception 'School name is required for this source';
  end if;
  if new.source = 'june_schools' and coalesce(new.school_context->>'school_issue_area', '')
    not in ('subscription', 'access', 'classes', 'grade', 'content', 'other') then
    raise exception 'Choose the issue type';
  end if;
  if new.source = 'june_schools' and coalesce(new.school_context->>'school_update_requested', '')
    not in ('yes', 'no', 'unknown') then
    raise exception 'Choose whether a MySchool update was already requested';
  end if;
  return new;
end $$;

create or replace function private.guard_ticket_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.ticket_number, new.source, new.created_by, new.created_at, new.customer_id, new.conversation_id,
      new.customer_name, new.customer_email, new.customer_phone, new.school_name, new.credentials_username,
      new.issue_date, new.city_id, new.end_user_type, new.fawry_payment, new.platform, new.is_latest_version,
      new.app_version, new.device_type, new.page_screen, new.steps, new.issue_description, new.is_historical,
      new.school_context)
     is distinct from
     (old.ticket_number, old.source, old.created_by, old.created_at, old.customer_id, old.conversation_id,
      old.customer_name, old.customer_email, old.customer_phone, old.school_name, old.credentials_username,
      old.issue_date, old.city_id, old.end_user_type, old.fawry_payment, old.platform, old.is_latest_version,
      old.app_version, old.device_type, old.page_screen, old.steps, old.issue_description, old.is_historical,
      old.school_context) then
    raise exception 'Submitted ticket details can''t be changed';
  end if;

  if new.status = 'resolved' and (
    new.request_type_id is null or new.topic_id is null or new.tracker_cause_id is null
    or new.tracker_action_id is null or new.outcome_id is null
  ) then
    raise exception 'Record request type, topic, cause, action, and outcome before resolving';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      new.resolved_at := now();
      new.closed_at := null;
    elsif new.status = 'closed' then
      new.closed_at := now();
    else
      new.resolved_at := null;
      new.closed_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
