-- Neutral department representatives; legacy role values remain unchanged.
alter type public.user_role add value if not exists 'department_member';
