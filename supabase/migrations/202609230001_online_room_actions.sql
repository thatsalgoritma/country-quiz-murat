create or replace function public.create_game_room(
  p_code text,
  p_mode text,
  p_display_name text
)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  new_room public.game_rooms;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.game_rooms (code, host_id, mode)
  values (upper(p_code), auth.uid(), p_mode)
  returning * into new_room;

  insert into public.game_room_players (room_id, user_id, player_number, display_name)
  values (new_room.id, auth.uid(), 1, trim(p_display_name));

  return new_room;
end;
$$;

create or replace function public.join_game_room(
  p_code text,
  p_display_name text
)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.game_rooms;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into room
  from public.game_rooms
  where code = upper(p_code)
  for update;

  if room.id is null then
    raise exception 'Room not found';
  end if;
  if room.status <> 'waiting' then
    raise exception 'Room is no longer available';
  end if;

  insert into public.game_room_players (room_id, user_id, player_number, display_name)
  values (room.id, auth.uid(), 2, trim(p_display_name));

  update public.game_rooms
  set status = 'playing'
  where id = room.id
  returning * into room;

  return room;
end;
$$;

create or replace function public.submit_game_answer(
  p_room_id uuid,
  p_target_key text
)
returns boolean
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
  if room.status <> 'playing' then
    raise exception 'Game has not started';
  end if;
  if room.active_player <> player_number then
    raise exception 'It is not your turn';
  end if;

  insert into public.game_room_answers (room_id, target_key, player_number)
  values (p_room_id, p_target_key, player_number)
  on conflict (room_id, target_key) do nothing;

  if not found then
    return false;
  end if;

  update public.game_rooms
  set active_player = case when active_player = 1 then 2 else 1 end
  where id = p_room_id;

  return true;
end;
$$;

grant execute on function public.create_game_room(text, text, text) to authenticated;
grant execute on function public.join_game_room(text, text) to authenticated;
grant execute on function public.submit_game_answer(uuid, text) to authenticated;
