-- Run once in Supabase -> SQL Editor on a NEW project. Generated from supabase/migrations + supabase/seed.sql.

-- ===== 20260926181144_auth_and_rbac.sql =====

-- Roles, profiles, admin flag, Settings lists, login lockout.
-- Nothing is ever deleted (D-13): no DELETE policies anywhere; users and list values are deactivated/archived.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.user_role as enum ('support_agent', 'moderation', 'call_center', 'manager');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null,
  role public.user_role not null,
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (lower(email));

-- is_admin must only be granted by the owner in the database, never through the app.
create or replace function private.protect_admin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin and current_user <> 'postgres' then
    raise exception 'is_admin can only be changed directly in the database';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function private.protect_admin_flag();

-- A profile is created for every auth user from app_metadata set by the admin
-- (app_metadata is not user-editable, unlike user_metadata).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_app_meta_data ->> 'full_name', ''), new.email),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'moderation')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer, unexposed schema)
-- ---------------------------------------------------------------------------
create or replace function private.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid()) and is_active;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.profiles where id = (select auth.uid()) and is_active and role = 'support_agent'),
    false
  );
$$;

revoke all on function private.current_role() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles enable row level security;

-- Everyone reads their own profile; Technical Support and Managers read all (assignee names, ticket history).
-- Writes go through server actions using the service role after an is_admin check.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.current_role()) in ('support_agent', 'manager')
  );

-- ---------------------------------------------------------------------------
-- Settings lists
-- ---------------------------------------------------------------------------
create table public.cities (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 80),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index cities_name_key on public.cities (lower(name));

create table public.issue_categories (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index issue_categories_name_key on public.issue_categories (lower(name));

create table public.root_causes (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index root_causes_name_key on public.root_causes (lower(name));

alter table public.cities enable row level security;
alter table public.issue_categories enable row level security;
alter table public.root_causes enable row level security;

create policy "cities_select" on public.cities
  for select to authenticated using ((select private.current_role()) is not null);
create policy "cities_insert" on public.cities
  for insert to authenticated with check ((select private.is_admin()));
create policy "cities_update" on public.cities
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "issue_categories_select" on public.issue_categories
  for select to authenticated using ((select private.current_role()) is not null);
create policy "issue_categories_insert" on public.issue_categories
  for insert to authenticated with check ((select private.is_admin()));
create policy "issue_categories_update" on public.issue_categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "root_causes_select" on public.root_causes
  for select to authenticated using ((select private.current_role()) is not null);
create policy "root_causes_insert" on public.root_causes
  for insert to authenticated with check ((select private.is_admin()));
create policy "root_causes_update" on public.root_causes
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- App settings (notification email, …)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.app_settings enable row level security;

create policy "app_settings_select" on public.app_settings
  for select to authenticated using ((select private.is_admin()));
create policy "app_settings_insert" on public.app_settings
  for insert to authenticated with check ((select private.is_admin()));
create policy "app_settings_update" on public.app_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.app_settings (key, value)
values ('notification_emails', '[]'::jsonb);

-- ---------------------------------------------------------------------------
-- Login attempts (lockout after 5 failures in 15 minutes).
-- RLS on with no policies: only the service role (server) can read/write.
-- ---------------------------------------------------------------------------
create table public.auth_login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);
create index auth_login_attempts_email_time on public.auth_login_attempts (lower(email), attempted_at desc);

alter table public.auth_login_attempts enable row level security;
revoke all on public.auth_login_attempts from anon, authenticated;

-- Signs a user out everywhere (after a password or role change, or deactivation).
-- Callable by the service role only.
create or replace function public.revoke_user_sessions(target_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = target_user;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;


-- ===== 20260926183507_tickets.sql =====

-- Tickets, customers, numbering, attachments, status history (audit log).
-- Business rules live here so they hold regardless of caller (technical-design §5.3).

create type public.ticket_status as enum ('new', 'in_progress', 'awaiting_customer', 'resolved', 'closed');
create type public.ticket_source as enum ('whatsapp', 'moderation', 'call_center');
create type public.end_user_type as enum ('student', 'teacher', 'parent', 'other');
create type public.app_platform as enum ('android', 'ios', 'web');

-- ---------------------------------------------------------------------------
-- Customers (matched by phone or email to warn about duplicates across channels)
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_e164 text unique,
  email text,
  created_at timestamptz not null default now()
);
create index customers_email_idx on public.customers (lower(email));

alter table public.customers enable row level security;
create policy "customers_select" on public.customers
  for select to authenticated using ((select private.current_role()) in ('support_agent', 'manager'));

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
create table public.ticket_counters (
  year integer primary key,
  last_value integer not null default 0
);
alter table public.ticket_counters enable row level security;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  source public.ticket_source not null,
  status public.ticket_status not null default 'new',
  created_by uuid not null references public.profiles (id),
  customer_id uuid references public.customers (id),
  conversation_id uuid,
  linked_ticket_id uuid references public.tickets (id),
  assignee_id uuid references public.profiles (id),

  -- Form fields (FRD §5), locked after submit
  customer_name text not null check (char_length(customer_name) >= 2),
  customer_email text,
  customer_phone text,
  school_name text,
  credentials_username text,
  issue_date date,
  city_id bigint references public.cities (id),
  end_user_type public.end_user_type,
  fawry_payment boolean,
  platform public.app_platform,
  is_latest_version boolean,
  app_version text,
  device_type text,
  page_screen text,
  steps text,
  issue_description text not null check (char_length(issue_description) >= 5),

  -- Technical Support fields (D-1)
  issue_category_id bigint references public.issue_categories (id),
  root_cause_id bigint references public.root_causes (id),
  action_taken text,
  resolution_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,

  constraint form_tickets_have_all_fields check (
    source = 'whatsapp' or (
      customer_email is not null and credentials_username is not null and issue_date is not null
      and city_id is not null and end_user_type is not null and fawry_payment is not null
      and platform is not null and is_latest_version is not null and app_version is not null
      and device_type is not null and page_screen is not null and steps is not null
    )
  ),
  constraint whatsapp_tickets_have_phone check (source <> 'whatsapp' or customer_phone is not null)
);

create unique index tickets_one_active_per_conversation
  on public.tickets (conversation_id)
  where conversation_id is not null and status <> 'closed';
create index tickets_created_by_idx on public.tickets (created_by, created_at desc);
create index tickets_status_idx on public.tickets (status, created_at desc);
create index tickets_source_idx on public.tickets (source, created_at desc);
create index tickets_customer_idx on public.tickets (customer_id);

-- BEFORE INSERT: status, creator, source, number, customer. Callers can't choose these.
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
begin
  new.status := 'new';
  new.created_at := now();
  new.updated_at := now();
  new.resolved_at := null;
  new.closed_at := null;

  if (select auth.uid()) is not null then
    new.created_by := (select auth.uid());
    case caller_role
      when 'moderation' then new.source := 'moderation';
      when 'call_center' then new.source := 'call_center';
      when 'support_agent' then new.source := 'whatsapp';
      else raise exception 'Your role can''t create tickets';
    end case;

    if caller_role <> 'support_agent' then
      new.assignee_id := null;
      new.issue_category_id := null;
      new.root_cause_id := null;
      new.action_taken := null;
      new.resolution_notes := null;
      new.linked_ticket_id := null;
      new.conversation_id := null;
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

create trigger tickets_before_insert
  before insert on public.tickets
  for each row execute function private.set_ticket_defaults();

-- BEFORE UPDATE: Closed is final, form fields are locked, Resolved needs a category.
create or replace function private.guard_ticket_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'closed' then
    raise exception 'Closed tickets can''t be edited. Create a follow-up ticket instead.';
  end if;

  if (new.ticket_number, new.source, new.created_by, new.created_at, new.customer_id, new.conversation_id,
      new.customer_name, new.customer_email, new.customer_phone, new.school_name, new.credentials_username,
      new.issue_date, new.city_id, new.end_user_type, new.fawry_payment, new.platform, new.is_latest_version,
      new.app_version, new.device_type, new.page_screen, new.steps, new.issue_description)
     is distinct from
     (old.ticket_number, old.source, old.created_by, old.created_at, old.customer_id, old.conversation_id,
      old.customer_name, old.customer_email, old.customer_phone, old.school_name, old.credentials_username,
      old.issue_date, old.city_id, old.end_user_type, old.fawry_payment, old.platform, old.is_latest_version,
      old.app_version, old.device_type, old.page_screen, old.steps, old.issue_description) then
    raise exception 'Submitted ticket details can''t be changed';
  end if;

  if new.status = 'resolved' and new.issue_category_id is null then
    raise exception 'Pick an issue category before resolving the ticket';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      new.resolved_at := now();
    elsif new.status = 'closed' then
      new.closed_at := now();
    else
      new.resolved_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tickets_before_update
  before update on public.tickets
  for each row execute function private.guard_ticket_update();

alter table public.tickets enable row level security;

create policy "tickets_select" on public.tickets
  for select to authenticated
  using (
    (select private.current_role()) in ('support_agent', 'manager')
    or created_by = (select auth.uid())
  );

create policy "tickets_insert" on public.tickets
  for insert to authenticated
  with check (
    (select private.current_role()) in ('moderation', 'call_center', 'support_agent')
    and created_by = (select auth.uid())
  );

create policy "tickets_update" on public.tickets
  for update to authenticated
  using ((select private.current_role()) = 'support_agent')
  with check ((select private.current_role()) = 'support_agent');

-- ---------------------------------------------------------------------------
-- Status history (audit log): insert-only, written by trigger
-- ---------------------------------------------------------------------------
create table public.ticket_status_history (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id),
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);
create index ticket_status_history_ticket_idx on public.ticket_status_history (ticket_id, changed_at);

create or replace function private.log_ticket_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_status_history (ticket_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif new.status is distinct from old.status then
    insert into public.ticket_status_history (ticket_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger tickets_log_status
  after insert or update of status on public.tickets
  for each row execute function private.log_ticket_status();

alter table public.ticket_status_history enable row level security;
create policy "ticket_status_history_select" on public.ticket_status_history
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

-- ---------------------------------------------------------------------------
-- Attachments
-- ---------------------------------------------------------------------------
create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'video/mp4', 'video/quicktime')),
  size_bytes bigint not null check (
    size_bytes > 0
    and size_bytes <= case when mime_type like 'image/%' then 10485760 else 52428800 end
  ),
  uploaded_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

create or replace function private.limit_ticket_attachments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.ticket_attachments where ticket_id = new.ticket_id) >= 5 then
    raise exception 'A ticket can have at most 5 attachments';
  end if;
  return new;
end;
$$;

create trigger ticket_attachments_limit
  before insert on public.ticket_attachments
  for each row execute function private.limit_ticket_attachments();

alter table public.ticket_attachments enable row level security;

create policy "ticket_attachments_select" on public.ticket_attachments
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

-- Creators attach files while submitting (within 30 minutes); Technical Support any time.
create policy "ticket_attachments_insert" on public.ticket_attachments
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.status <> 'closed'
        and (
          (select private.current_role()) = 'support_agent'
          or (t.created_by = (select auth.uid()) and t.created_at > now() - interval '30 minutes')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: ticket-attachments/{ticket_id}/{file}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments', 'ticket-attachments', false, 52428800,
  array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "ticket_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and exists (select 1 from public.tickets t where t.id::text = (storage.foldername(name))[1])
  );

create policy "ticket_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and exists (
      select 1 from public.tickets t
      where t.id::text = (storage.foldername(name))[1]
        and t.status <> 'closed'
        and (
          (select private.current_role()) = 'support_agent'
          or (t.created_by = (select auth.uid()) and t.created_at > now() - interval '30 minutes')
        )
    )
  );


-- ===== 20260926193421_optional_fields_and_huawei.sql =====



-- ===== 20260926194042_optional_fields_and_huawei.sql =====

-- App version, device type, page/screen and steps become optional on the form. Huawei joins the platforms.

alter type public.app_platform add value if not exists 'huawei' after 'ios';

alter table public.tickets drop constraint form_tickets_have_all_fields;
alter table public.tickets add constraint form_tickets_have_all_fields check (
  source = 'whatsapp' or (
    customer_email is not null and credentials_username is not null and issue_date is not null
    and city_id is not null and end_user_type is not null and fawry_payment is not null
    and platform is not null and is_latest_version is not null
  )
);


-- ===== seed.sql =====

-- Starter values for Settings. The admin edits them from Settings; nothing here is final.

insert into public.cities (name, sort_order) values
  ('Cairo', 1), ('Giza', 2), ('Alexandria', 3), ('Qalyubia', 4), ('Sharqia', 5),
  ('Dakahlia', 6), ('Gharbia', 7), ('Monufia', 8), ('Beheira', 9), ('Kafr El Sheikh', 10),
  ('Damietta', 11), ('Port Said', 12), ('Ismailia', 13), ('Suez', 14), ('Faiyum', 15),
  ('Beni Suef', 16), ('Minya', 17), ('Asyut', 18), ('Sohag', 19), ('Qena', 20),
  ('Luxor', 21), ('Aswan', 22), ('Red Sea', 23), ('New Valley', 24), ('Matrouh', 25),
  ('North Sinai', 26), ('South Sinai', 27)
on conflict do nothing;

insert into public.issue_categories (name) values
  ('Login & access'), ('Payments & Fawry'), ('Video playback'),
  ('Exams & results'), ('Account & profile data'), ('App crash')
on conflict do nothing;

insert into public.root_causes (name) values
  ('Wrong password / forgotten login'), ('Fawry payment not synced'), ('Outdated app version'),
  ('Content link broken'), ('Wrong school or grade on profile'), ('Device not supported'),
  ('Server error'), ('User error / guidance given'), ('Duplicate account')
on conflict do nothing;

