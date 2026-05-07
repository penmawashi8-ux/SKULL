-- Migration: Skull → BOMB theme + timer + emote features
-- Run this in Supabase SQL Editor if you have an existing database.
-- For a fresh install, use schema.sql instead.

-- 1. Rename skull_count → bomb_count in players
alter table public.players rename column skull_count to bomb_count;

-- 2. Update disc_type check constraint: 'skull' → 'bomb'
alter table public.placed_discs
  drop constraint if exists placed_discs_disc_type_check;
alter table public.placed_discs
  add constraint placed_discs_disc_type_check
  check (disc_type in ('flower', 'bomb'));

-- 3. Add turn_started_at to game_states
alter table public.game_states
  add column if not exists turn_started_at timestamptz;

-- 4. Add last_emote (JSONB) to game_states
alter table public.game_states
  add column if not exists last_emote jsonb;

-- 5. (Optional) Migrate existing 'skull' disc_type values to 'bomb'
--    Uncomment if you have live data to preserve:
-- update public.placed_discs set disc_type = 'bomb' where disc_type = 'skull';
