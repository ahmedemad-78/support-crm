-- A location the team types when it is not in the City list yet (for example a new country).
-- The case keeps the "Other" city until an administrator adds the typed name to the list;
-- from then on reports count the case under the new city without rewriting the case.
alter table public.tickets add column city_other text;
alter table public.tickets add constraint tickets_city_other_length
  check (city_other is null or char_length(city_other) between 2 and 80);
comment on column public.tickets.city_other is
  'Location typed at intake when City is "Other". Protected by the existing ticket RLS policies.';
insert into public.cities (name, sort_order)
select 'Other', 998 where not exists (select 1 from public.cities where lower(name) = 'other');
