-- Optional structured facts for future 30 June cases only. No backfill.
alter table public.tickets add column school_context jsonb;
alter table public.tickets add constraint tickets_school_context_object
  check (school_context is null or (jsonb_typeof(school_context)='object' and octet_length(school_context::text)<=4096));
comment on column public.tickets.school_context is
  'Optional 30 June / MySchool intake facts. Existing cases are not backfilled. Protected by the existing ticket RLS policies.';
