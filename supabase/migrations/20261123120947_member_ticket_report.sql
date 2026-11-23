create function private.work_member_performance(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.work_active() or not(private.is_admin() or private.current_role()='manager') then
  raise exception 'Performance reports are for admin and managers only';
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'number',t.ticket_number,'title',t.title,'state',t.state,
  'solved',exists(select 1 from public.work_ticket_resolutions r where r.ticket_id=t.id and r.resolver_credit_id=p_member and t.state='resolved' and r.cycle=t.reopen_count),
  'working_seconds',(select coalesce(sum(extract(epoch from coalesce(s.ended_at,now())-s.started_at)),0) from public.work_ticket_segments s where s.ticket_id=t.id and s.worker_id=p_member and s.kind='working'),
  'waiting_seconds',(select coalesce(sum(extract(epoch from coalesce(s.ended_at,now())-s.started_at)),0) from public.work_ticket_segments s where s.ticket_id=t.id and s.worker_id=p_member and s.kind='waiting')
 ) order by t.updated_at desc,t.id),'[]') from public.work_tickets t where
  exists(select 1 from public.work_ticket_segments s where s.ticket_id=t.id and s.worker_id=p_member)
  or exists(select 1 from public.work_ticket_resolutions r where r.ticket_id=t.id and r.resolver_credit_id=p_member));
end $$;
revoke all on function private.work_member_performance(uuid) from public,anon;
grant execute on function private.work_member_performance(uuid) to authenticated;
create function public.work_member_performance(member uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.work_member_performance(member)$$;
revoke all on function public.work_member_performance(uuid) from public,anon;
grant execute on function public.work_member_performance(uuid) to authenticated;
