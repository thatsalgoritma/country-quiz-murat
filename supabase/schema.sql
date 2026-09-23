create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id),
  mode text not null check (mode in ('capital-write', 'country-write', 'city-write', 'flag-write')),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  active_player smallint not null default 1 check (active_player in (1, 2)),
  created_at timestamptz not null default now()
);

create table public.game_room_players (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_number smallint not null check (player_number in (1, 2)),
  display_name text not null check (char_length(display_name) between 1 and 24),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, player_number)
);

create table public.game_room_answers (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  target_key text not null,
  player_number smallint not null check (player_number in (1, 2)),
  answered_at timestamptz not null default now(),
  primary key (room_id, target_key)
);

alter table public.game_rooms enable row level security;
alter table public.game_room_players enable row level security;
alter table public.game_room_answers enable row level security;

create policy "players can read their rooms"
on public.game_rooms for select to authenticated
using (
  exists (
    select 1 from public.game_room_players
    where room_id = game_rooms.id and user_id = auth.uid()
  )
);

create policy "players can read room members"
on public.game_room_players for select to authenticated
using (
  exists (
    select 1 from public.game_room_players as membership
    where membership.room_id = game_room_players.room_id and membership.user_id = auth.uid()
  )
);

create policy "players can read room answers"
on public.game_room_answers for select to authenticated
using (
  exists (
    select 1 from public.game_room_players
    where room_id = game_room_answers.room_id and user_id = auth.uid()
  )
);

alter publication supabase_realtime add table public.game_rooms;
alter publication supabase_realtime add table public.game_room_players;
alter publication supabase_realtime add table public.game_room_answers;
