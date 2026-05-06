-- BOMB Game Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── rooms ──────────────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  room_code     text not null unique,
  status        text not null default 'waiting' check (status in ('waiting','playing','finished')),
  host_id       text not null,
  max_players   int  not null default 4,
  current_round int  not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── players ────────────────────────────────────────────────────────────────────
create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  player_name   text not null,
  player_color  text not null default 'purple',
  seat_order    int  not null default 1,
  is_cpu        boolean not null default false,
  session_id    text not null,
  flower_count  int  not null default 3,
  bomb_count    int  not null default 1,
  win_count     int  not null default 0,
  is_eliminated boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── game_states ────────────────────────────────────────────────────────────────
create table if not exists public.game_states (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.rooms(id) on delete cascade,
  round_number       int  not null default 1,
  phase              text not null default 'place' check (phase in ('place','bid','flip')),
  current_player_id  uuid references public.players(id) on delete set null,
  highest_bid        int  not null default 0,
  highest_bidder_id  uuid references public.players(id) on delete set null,
  pass_count         int  not null default 0,
  flip_count         int  not null default 0,
  turn_started_at    timestamptz,
  last_emote         jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── placed_discs ───────────────────────────────────────────────────────────────
create table if not exists public.placed_discs (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  round_number int  not null,
  disc_type    text not null default 'flower' check (disc_type in ('flower','bomb')),
  position     int  not null default 1,
  is_flipped   boolean not null default false,
  flipped_by   uuid references public.players(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ── Row Level Security (allow all for anonymous users) ─────────────────────────
alter table public.rooms        enable row level security;
alter table public.players      enable row level security;
alter table public.game_states  enable row level security;
alter table public.placed_discs enable row level security;

create policy "allow all rooms"        on public.rooms        for all using (true) with check (true);
create policy "allow all players"      on public.players      for all using (true) with check (true);
create policy "allow all game_states"  on public.game_states  for all using (true) with check (true);
create policy "allow all placed_discs" on public.placed_discs for all using (true) with check (true);

-- ── Realtime ───────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.game_states;
alter publication supabase_realtime add table public.placed_discs;
