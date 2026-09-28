-- New form reporters. Values are added here and used only in the next migration:
-- Postgres cannot use a new enum value in the same transaction that adds it.
alter type public.user_role add value if not exists 'june_schools';
alter type public.user_role add value if not exists 'business_development';

alter type public.ticket_source add value if not exists 'june_schools';
alter type public.ticket_source add value if not exists 'business_development';
