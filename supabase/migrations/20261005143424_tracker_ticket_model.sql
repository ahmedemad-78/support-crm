-- Tracker classification, editable sources, and Fawry on new tickets.
-- Historical rows stay valid when Fawry was never recorded.

create table public.ticket_sources (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  bound_role public.user_role,
  created_at timestamptz not null default now()
);
create unique index ticket_sources_name_key on public.ticket_sources (lower(name));
create unique index ticket_sources_one_role on public.ticket_sources (bound_role) where bound_role is not null;

insert into public.ticket_sources (code, name, sort_order, bound_role) values
  ('whatsapp', 'WhatsApp', 10, null),
  ('moderation', 'Moderation', 20, 'moderation'),
  ('call_center', 'Call', 30, 'call_center'),
  ('marketing_team', 'Marketing Team', 40, null),
  ('june_schools', '30 June Schools', 50, 'june_schools'),
  ('business_development', 'B2B Schools', 60, 'business_development'),
  ('google_play', 'Google Play', 70, null);

create table public.request_types (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index request_types_name_key on public.request_types (lower(name));

create table public.topics (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index topics_name_key on public.topics (lower(name));

create table public.tracker_causes (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index tracker_causes_name_key on public.tracker_causes (lower(name));

create table public.tracker_actions (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index tracker_actions_name_key on public.tracker_actions (lower(name));

create table public.outcomes (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index outcomes_name_key on public.outcomes (lower(name));

insert into public.request_types (name, sort_order) values
  ('Inquiry', 10),
  ('Technical Issue', 20),
  ('Complaint', 30),
  ('Promo Code Activation', 40),
  ('Feedback', 50),
  ('Other', 60);

insert into public.topics (name) values
  ('Account Access / Book QR Scanning'),
  ('App Bug'),
  ('Compensation Subscription / Grade Update'),
  ('Content Availability'),
  ('Content Availability / ICT Availability'),
  ('Content Availability / Lesson Access'),
  ('Content Availability / Parent Guide'),
  ('Content Availability / Refund Request'),
  ('Exercise Answers'),
  ('Grade 8 Profile Display'),
  ('Languages Bundle Coverage'),
  ('Lesson Video Access'),
  ('Locked Content'),
  ('Login / Platform Activation'),
  ('Login / Verification'),
  ('Missing Selah Eltelmeez / External Resources'),
  ('Practice Books Purchase'),
  ('Preparatory English Availability'),
  ('Preparatory Stage Availability'),
  ('Private Tutoring Availability'),
  ('Regional Availability'),
  ('Shared Learning Activity Tracking'),
  ('Student Grade / Outdated Account Data'),
  ('Subscription Access'),
  ('Subscription Access on Two Devices'),
  ('Subscription Payment'),
  ('Subscription Payment Methods'),
  ('Teacher QR Activation'),
  ('Weekly Homework / Assessments');

insert into public.tracker_causes (name) values
  ('Backend Bug'),
  ('Content Delay'),
  ('Different Account Used'),
  ('Escalate to Technical Team'),
  ('Fawry Payment Issue'),
  ('Frontend Bug'),
  ('Grade Update Issue'),
  ('Low User Experience'),
  ('MySchool Data Update Issue'),
  ('Not Applicable'),
  ('Other'),
  ('Outdated App Version'),
  ('Payment Confirmation Delay'),
  ('Practice Books Purchase'),
  ('Regional Access Restriction'),
  ('Setup / Usage Difficulty'),
  ('Under Investigation');

insert into public.tracker_actions (name) values
  ('Answer Inquiry'),
  ('Answer Inquiry / Follow Up'),
  ('Clarify Registered Account'),
  ('Escalate to Technical Team'),
  ('Explain E-learning Content'),
  ('Explain to Business Team'),
  ('Fix Backend Configuration'),
  ('Fix Frontend Bug'),
  ('Fixed by Technical Team'),
  ('Follow Up'),
  ('Investigate / Follow Up'),
  ('Other'),
  ('Request More Details'),
  ('Request More Details / Follow Up'),
  ('Resolve Content Availability'),
  ('Send Content Link'),
  ('Send Instructions'),
  ('Update App'),
  ('Update Grade and Activate Compensation');

insert into public.outcomes (name) values
  ('Content Available'),
  ('Fixed by Technical Team'),
  ('Information Provided'),
  ('Issue Persists'),
  ('Not Confirmed'),
  ('Other'),
  ('Payment Issue Resolved'),
  ('Resolved with Instructions'),
  ('Subscription Activated'),
  ('Update Grade and Activate Compensation'),
  ('Working After Update');

do $$
declare
  list_name text;
begin
  foreach list_name in array array[
    'ticket_sources', 'request_types', 'topics', 'tracker_causes', 'tracker_actions', 'outcomes'
  ]
  loop
    execute format('alter table public.%I enable row level security', list_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.current_role()) is not null)',
      list_name || '_select', list_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))',
      list_name || '_insert', list_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      list_name || '_update', list_name
    );
  end loop;
end $$;

alter table public.tickets
  add column request_type_id bigint references public.request_types (id),
  add column topic_id bigint references public.topics (id),
  add column tracker_cause_id bigint references public.tracker_causes (id),
  add column tracker_action_id bigint references public.tracker_actions (id),
  add column outcome_id bigint references public.outcomes (id),
  add column tracker_notes text,
  add column follow_up_notes text,
  add column is_historical boolean not null default false;

-- Existing resolved rows have no issue category. The old guard would reject
-- this backfill, and the new guard treats the flag as immutable.
alter table public.tickets disable trigger tickets_before_update;
update public.tickets
set is_historical = true
where coalesce(action_taken, '') like 'historical:%';
alter table public.tickets enable trigger tickets_before_update;

alter table public.tickets drop constraint if exists whatsapp_tickets_have_phone;
alter table public.tickets drop constraint form_tickets_have_all_fields;
alter table public.tickets alter column source type text using source::text;
alter table public.tickets
  add constraint tickets_source_fkey foreign key (source) references public.ticket_sources (code);

alter table public.tickets add constraint form_tickets_have_all_fields check (
  is_historical
  or coalesce(action_taken, '') like 'historical:%'
  or coalesce(action_taken, '') like 'tracker:%'
  or (
    customer_email is not null
    and credentials_username is not null
    and issue_date is not null
    and city_id is not null
    and end_user_type is not null
    and platform is not null
    and is_latest_version is not null
    and fawry_payment is not null
  )
);

create or replace function private.set_ticket_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role := private.current_role();
  ticket_year integer := extract(year from now() at time zone 'Africa/Cairo')::integer;
  next_value integer;
  found_customer uuid;
  chosen_source text;
begin
  new.status := 'new';
  new.created_at := now();
  new.updated_at := now();
  new.resolved_at := null;
  new.closed_at := null;
  new.is_historical := false;

  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
    if caller_role in ('moderation', 'call_center', 'june_schools', 'business_development') then
      select s.code into chosen_source
      from public.ticket_sources s
      where s.bound_role = caller_role and s.is_active
      limit 1;
      if chosen_source is null then
        raise exception 'No active source is assigned to your role';
      end if;
      new.source := chosen_source;
      new.assignee_id := null;
      new.issue_category_id := null;
      new.root_cause_id := null;
      new.action_taken := null;
      new.resolution_notes := null;
      new.follow_up_notes := null;
      new.tracker_notes := null;
      new.request_type_id := null;
      new.topic_id := null;
      new.tracker_cause_id := null;
      new.tracker_action_id := null;
      new.outcome_id := null;
      new.linked_ticket_id := null;
      new.conversation_id := null;
    elsif caller_role = 'support_agent' then
      if new.source is null or not exists (
        select 1 from public.ticket_sources s where s.code = new.source and s.is_active
      ) then
        new.source := 'whatsapp';
      end if;
    else
      raise exception 'Your role can''t create tickets';
    end if;
  end if;

  if new.issue_date is not null and new.issue_date > (now() at time zone 'Africa/Cairo')::date then
    raise exception 'Date of issue can''t be in the future';
  end if;

  insert into public.ticket_counters as c (year, last_value)
  values (ticket_year, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning last_value into next_value;
  new.ticket_number := 'TKT-' || ticket_year || '-' || lpad(next_value::text, 5, '0');

  if new.customer_phone is not null then
    select id into found_customer from public.customers where phone_e164 = new.customer_phone;
  end if;
  if found_customer is null and new.customer_email is not null then
    select id into found_customer from public.customers
    where lower(email) = lower(new.customer_email)
    order by created_at limit 1;
  end if;
  if found_customer is null then
    insert into public.customers (name, phone_e164, email)
    values (new.customer_name, new.customer_phone, new.customer_email)
    returning id into found_customer;
  end if;
  new.customer_id := found_customer;

  return new;
end;
$$;

create or replace function private.guard_ticket_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.ticket_number, new.source, new.created_by, new.created_at, new.customer_id, new.conversation_id,
      new.customer_name, new.customer_email, new.customer_phone, new.school_name, new.credentials_username,
      new.issue_date, new.city_id, new.end_user_type, new.fawry_payment, new.platform, new.is_latest_version,
      new.app_version, new.device_type, new.page_screen, new.steps, new.issue_description, new.is_historical)
     is distinct from
     (old.ticket_number, old.source, old.created_by, old.created_at, old.customer_id, old.conversation_id,
      old.customer_name, old.customer_email, old.customer_phone, old.school_name, old.credentials_username,
      old.issue_date, old.city_id, old.end_user_type, old.fawry_payment, old.platform, old.is_latest_version,
      old.app_version, old.device_type, old.page_screen, old.steps, old.issue_description, old.is_historical) then
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
    when 'awaiting_customer' then 'Awaiting Customer Reply'
    when 'resolved' then 'Resolved'
    when 'closed' then 'Closed - No Response'
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

  select case
    when p.role in ('moderation', 'call_center', 'june_schools', 'business_development')
      then '/portal/my-tickets/' || new.id::text
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
