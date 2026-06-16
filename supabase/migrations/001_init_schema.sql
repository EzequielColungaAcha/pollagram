-- 001_init_schema.sql
-- Polla lottery tracking schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE game_status AS ENUM ('draft', 'active', 'closed', 'archived');

CREATE TYPE audit_action AS ENUM (
  'player_created',
  'player_updated',
  'entry_created',
  'numbers_edited',
  'draw_entered',
  'draw_invalidated',
  'game_created',
  'game_opened',
  'game_closed',
  'game_archived',
  'settings_changed',
  'winner_recorded'
);

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  entry_fee NUMERIC(12, 2) NOT NULL DEFAULT 10000,
  prize_percent NUMERIC(5, 4) NOT NULL DEFAULT 0.85,
  default_cycle_days INTEGER NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id) VALUES (1);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  entry_fee NUMERIC(12, 2) NOT NULL,
  prize_percent NUMERIC(5, 4) NOT NULL,
  total_collected NUMERIC(14, 2) NOT NULL DEFAULT 0,
  rollover_in NUMERIC(14, 2) NOT NULL DEFAULT 0,
  prize_pool NUMERIC(14, 2) NOT NULL DEFAULT 0,
  final_awarded NUMERIC(14, 2),
  player_count INTEGER NOT NULL DEFAULT 0,
  status game_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CHECK (end_date >= start_date),
  CHECK (entry_fee >= 0),
  CHECK (prize_percent > 0 AND prize_percent <= 1)
);

CREATE UNIQUE INDEX games_one_active_idx ON games (status) WHERE status = 'active';

CREATE TABLE player_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  matched_count INTEGER NOT NULL DEFAULT 0 CHECK (matched_count >= 0 AND matched_count <= 10),
  remaining_count INTEGER NOT NULL DEFAULT 10 CHECK (remaining_count >= 0 AND remaining_count <= 10),
  completion_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  won_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, game_id)
);

CREATE TABLE entry_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES player_entries(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot >= 0 AND slot <= 9),
  number SMALLINT NOT NULL CHECK (number >= 0 AND number <= 99),
  UNIQUE (entry_id, slot)
);

CREATE TABLE lottery_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  draw_date DATE NOT NULL,
  entered_by UUID REFERENCES profiles(id),
  is_invalidated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, draw_date)
);

CREATE TABLE draw_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES lottery_draws(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position >= 0 AND position <= 19),
  number SMALLINT NOT NULL CHECK (number >= 0 AND number <= 99),
  UNIQUE (draw_id, position)
);

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES player_entries(id) ON DELETE CASCADE,
  entry_number_id UUID NOT NULL UNIQUE REFERENCES entry_numbers(id) ON DELETE CASCADE,
  draw_id UUID NOT NULL REFERENCES lottery_draws(id) ON DELETE RESTRICT,
  draw_number_id UUID NOT NULL REFERENCES draw_numbers(id) ON DELETE RESTRICT,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES player_entries(id) ON DELETE RESTRICT,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  prize_amount NUMERIC(14, 2) NOT NULL,
  won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_id, game_id)
);

CREATE TABLE prize_rollovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  to_game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX games_status_start_idx ON games (status, start_date DESC);
CREATE INDEX player_entries_leaderboard_idx ON player_entries (game_id, matched_count DESC, remaining_count ASC);
CREATE INDEX matches_entry_idx ON matches (entry_id);
CREATE INDEX matches_draw_idx ON matches (draw_id);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX lottery_draws_game_idx ON lottery_draws (game_id, draw_date DESC);
CREATE INDEX winners_game_idx ON winners (game_id);
