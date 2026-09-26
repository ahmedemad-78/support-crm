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
