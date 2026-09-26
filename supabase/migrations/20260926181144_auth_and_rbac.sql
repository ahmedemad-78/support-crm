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
