create or replace function public.pass_game_turn(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.game_rooms;
  player_number smallint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into room
  from public.game_rooms
  where id = p_room_id
  for update;

  select game_room_players.player_number into player_number
  from public.game_room_players
  where room_id = p_room_id and user_id = auth.uid();

  if room.id is null or player_number is null then
    raise exception 'You are not a player in this room';
  end if;
  if room.status <> 'playing' or room.active_player <> player_number then
    raise exception 'It is not your turn';
  end if;

  update public.game_rooms
  set active_player = case when active_player = 1 then 2 else 1 end
  where id = p_room_id;
end;
$$;

grant execute on function public.pass_game_turn(uuid) to authenticated;
