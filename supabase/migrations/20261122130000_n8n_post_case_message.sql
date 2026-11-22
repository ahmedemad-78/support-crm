create or replace function public.n8n_post_case_message(
  case_id uuid,
  request_id uuid,
  message_body text,
  sender_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket public.tickets;
  support_user_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise insufficient_privilege;
  end if;

  if request_id is null
    or sender_name is null
    or sender_name not in ('AI Agent', 'Support')
    or message_body is null
    or length(btrim(message_body)) not between 2 and 4000 then
    raise exception 'Invalid message';
  end if;

  select identity.user_id
    into support_user_id
    from private.n8n_identity as identity
    join public.profiles as profile on profile.id = identity.user_id
   where profile.is_active
     and not profile.is_admin
     and profile.role = 'support_agent'
   limit 1;

  if support_user_id is null then
    raise exception 'n8n support identity is not configured';
  end if;

  select *
    into ticket
    from public.tickets
   where id = case_id
   for update;

  if ticket.id is null then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  perform set_config('request.jwt.claim.sub', support_user_id::text, true);

  insert into public.ticket_workflow_events (
    id, ticket_id, actor_id, kind, body, sender_name, is_automated
  ) values (
    request_id, case_id, support_user_id, 'comment', btrim(message_body),
    sender_name, sender_name = 'AI Agent'
  );

  perform private.workflow_notice(ticket, request_id, 'New comment', btrim(message_body));

  return request_id;
end;
$$;

revoke execute on function public.n8n_post_case_message(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.n8n_post_case_message(uuid, uuid, text, text)
  to service_role;
