-- Payment provider is no longer a required ticket intake field.
-- Keep historical values in the nullable column without asking new customers for one.
alter table public.tickets drop constraint form_tickets_have_all_fields;
alter table public.tickets add constraint form_tickets_have_all_fields check (
  source = 'whatsapp' or (
    customer_email is not null and credentials_username is not null and issue_date is not null
    and city_id is not null and end_user_type is not null
    and platform is not null and is_latest_version is not null
  )
);
