create or replace function public.is_game_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_room_players
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_game_room_member(uuid) from public;
grant execute on function public.is_game_room_member(uuid) to authenticated;

drop policy if exists "players can read their rooms" on public.game_rooms;
drop policy if exists "players can read room members" on public.game_room_players;
drop policy if exists "players can read room answers" on public.game_room_answers;

create policy "players can read their rooms"
on public.game_rooms for select to authenticated
using (public.is_game_room_member(id));

create policy "players can read room members"
on public.game_room_players for select to authenticated
using (public.is_game_room_member(room_id));

create policy "players can read room answers"
on public.game_room_answers for select to authenticated
using (public.is_game_room_member(room_id));
