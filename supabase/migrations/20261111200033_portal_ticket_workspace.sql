-- Read model only: no historical ticket/notification data is rewritten.
-- Caller identity comes from auth.uid(), never a client-supplied user ID.
create index tickets_reporting_owner_idx on public.tickets((coalesce(reporter_id,created_by)),created_at desc);
create index notifications_unread_ticket_event_idx on public.notifications(recipient_id,ticket_id,event_id) where read_at is null and event_id is not null;
create function public.my_ticket_workspace(p_view text default 'all',p_search text default '',p_page integer default 1,p_sort text default 'activity')
returns jsonb language sql stable security invoker set search_path='' as $$
with base as materialized (
  select t.id,t.ticket_number,t.issue_description,t.customer_name,t.status,t.source,t.created_at,t.updated_at,t.reopen_count,t.last_reopened_at,
    greatest(t.updated_at,coalesce(a.last_event_at,t.created_at)) as last_activity_at,
    coalesce(r.replies,0)::int as unread_replies
  from public.tickets t
  left join lateral (select max(e.created_at) last_event_at from public.ticket_workflow_events e where e.ticket_id=t.id) a on true
  left join lateral (
    select count(*) replies from public.notifications n join public.ticket_workflow_events e on e.id=n.event_id
    where n.ticket_id=t.id and n.recipient_id=(select auth.uid()) and n.read_at is null and e.kind in ('comment','resolved')
  ) r on true
  where (select private.current_role()) in ('call_center','moderation','june_schools','business_development')
    and coalesce(t.reporter_id,t.created_by)=(select auth.uid())
), filtered as materialized (
  select * from base where
    (case p_view when 'open' then status not in ('resolved','closed') when 'waiting' then status='awaiting_customer'
      when 'unread' then unread_replies>0 when 'reopened' then reopen_count>0 when 'finished' then status in ('resolved','closed') else true end)
    and (coalesce(btrim(p_search),'')='' or strpos(lower(ticket_number||' '||customer_name||' '||issue_description),lower(left(btrim(p_search),120)))>0)
), counts as (
  select count(*) total,greatest(1,ceil(count(*)/25.0))::int pages from filtered
), paging as (
  select *,least(greatest(coalesce(p_page,1),1),pages) page from counts
), paged as (
  select * from filtered order by
    case when p_sort='unread' then unread_replies end desc nulls last,
    case when p_sort='oldest' then created_at end asc nulls last,
    last_activity_at desc,id
  limit 25 offset (select (page::bigint-1)*25 from paging)
)
select jsonb_build_object(
 'rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),
 'matched',(select total from paging),'page',(select page from paging),'pages',(select pages from paging),'page_size',25,
 'summary',(select jsonb_build_object('all',count(*),'open',count(*) filter(where status not in ('resolved','closed')),
   'waiting',count(*) filter(where status='awaiting_customer'),'unread',count(*) filter(where unread_replies>0),
   'unread_replies',coalesce(sum(unread_replies),0),'reopened',count(*) filter(where reopen_count>0),
   'finished',count(*) filter(where status in ('resolved','closed'))) from base))
$$;
revoke all on function public.my_ticket_workspace(text,text,integer,text) from public,anon;
grant execute on function public.my_ticket_workspace(text,text,integer,text) to authenticated;

-- Only the IDs loaded into this conversation are acknowledged; a newer reply
-- arriving in parallel remains unread. RLS and explicit ownership both apply.
create function public.mark_ticket_replies_read(p_ticket uuid,p_events uuid[])
returns integer language sql security invoker set search_path='' as $$
with changed as (
 update public.notifications n set read_at=now()
 where n.ticket_id=p_ticket and n.recipient_id=(select auth.uid()) and n.read_at is null
 and cardinality(p_events) between 1 and 500
 and (select private.current_role()) in ('call_center','moderation','june_schools','business_development')
 and n.event_id=any(p_events) and exists(select 1 from public.ticket_workflow_events e
   where e.id=n.event_id and e.ticket_id=p_ticket and e.kind in ('comment','resolved'))
 returning n.id
) select count(*)::integer from changed
$$;
revoke all on function public.mark_ticket_replies_read(uuid,uuid[]) from public,anon;
grant execute on function public.mark_ticket_replies_read(uuid,uuid[]) to authenticated;
