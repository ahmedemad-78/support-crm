-- 30 June Schools and Business Development open tickets the same way Moderation
-- and Call Center do. The trigger stamps source from the role, so each team's
-- tickets stay separate on the dashboard.

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
    if caller_role in ('moderation', 'call_center', 'june_schools', 'business_development') then
      new.source := caller_role::text::public.ticket_source;
    elsif caller_role = 'support_agent' then
      new.source := 'whatsapp';
    else
      raise exception 'Your role can''t create tickets';
    end if;

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

drop policy if exists "tickets_insert" on public.tickets;
create policy "tickets_insert" on public.tickets
  for insert to authenticated
  with check (
    (select private.current_role()) in (
      'moderation',
      'call_center',
      'june_schools',
      'business_development',
      'support_agent'
    )
    and created_by = (select auth.uid())
  );

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
    when 'awaiting_customer' then 'Awaiting Customer'
    when 'resolved' then 'Resolved'
    when 'closed' then 'Closed'
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

revoke all on function private.notify_status_change() from public;
