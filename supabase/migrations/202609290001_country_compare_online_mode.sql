-- Allow the existing authenticated room flow to create comparison rooms.
-- Answers still go through submit_game_answer, which locks the room, checks
-- membership and turn ownership, and enforces one use per country key.
alter table public.game_rooms
  drop constraint if exists game_rooms_mode_check;

alter table public.game_rooms
  add constraint game_rooms_mode_check
  check (mode in ('capital-write', 'country-write', 'city-write', 'flag-write', 'country-compare'));
