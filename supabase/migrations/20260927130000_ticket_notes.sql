-- Internal notes on a ticket. Visible to Technical Support and Managers only.
-- Creators (Moderation / Call Center) never see them (FRD UC-6, UI spec S5).

create table public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id),
  author_id uuid not null references public.profiles (id) default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index ticket_notes_ticket_idx on public.ticket_notes (ticket_id, created_at);

alter table public.ticket_notes enable row level security;

create policy "ticket_notes_select" on public.ticket_notes
  for select to authenticated
  using ((select private.current_role()) in ('support_agent', 'manager'));

create policy "ticket_notes_insert" on public.ticket_notes
  for insert to authenticated
  with check (
    (select private.current_role()) = 'support_agent'
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.status <> 'closed'
    )
  );
