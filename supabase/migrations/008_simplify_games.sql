-- 008_simplify_games.sql
-- Multiple active games, simplified game creation, combined player registration.

DROP INDEX IF EXISTS games_one_active_idx;

ALTER TABLE games ALTER COLUMN start_date SET DEFAULT CURRENT_DATE;
ALTER TABLE games ALTER COLUMN end_date SET DEFAULT CURRENT_DATE;
ALTER TABLE games ALTER COLUMN label SET DEFAULT '';

DROP FUNCTION IF EXISTS rpc_create_game(TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION rpc_create_game()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_settings app_settings%ROWTYPE;
  v_rollover NUMERIC(14, 2) := 0;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_settings FROM app_settings WHERE id = 1;

  SELECT COALESCE(g.prize_pool, 0) INTO v_rollover
  FROM games g
  WHERE g.status = 'closed'
    AND NOT EXISTS (SELECT 1 FROM winners w WHERE w.game_id = g.id)
  ORDER BY g.closed_at DESC NULLS LAST
  LIMIT 1;

  v_rollover := COALESCE(v_rollover, 0);

  INSERT INTO games (
    label, start_date, end_date, entry_fee, prize_percent, rollover_in, status
  )
  VALUES (
    '', CURRENT_DATE, CURRENT_DATE,
    v_settings.entry_fee, v_settings.prize_percent, v_rollover, 'active'
  )
  RETURNING id INTO v_id;

  IF v_rollover > 0 THEN
    INSERT INTO prize_rollovers (from_game_id, to_game_id, amount)
    SELECT g.id, v_id, v_rollover FROM games g
    WHERE g.status = 'closed'
      AND NOT EXISTS (SELECT 1 FROM winners w WHERE w.game_id = g.id)
    ORDER BY g.closed_at DESC NULLS LAST LIMIT 1;
  END IF;

  PERFORM log_audit('game_created', 'games', v_id, NULL,
    jsonb_build_object('rollover_in', v_rollover, 'status', 'active'));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_open_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE games SET status = 'active' WHERE id = p_game_id AND status = 'draft';

  PERFORM log_audit('game_opened', 'games', p_game_id, NULL, jsonb_build_object('status', 'active'));
END;
$$;

CREATE OR REPLACE FUNCTION rpc_register_player_entry(
  p_game_id UUID,
  p_name TEXT,
  p_numbers SMALLINT[],
  p_nickname TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id UUID;
  v_entry_id UUID;
  v_i INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF array_length(p_numbers, 1) != 10 THEN
    RAISE EXCEPTION 'Exactly 10 numbers required';
  END IF;

  FOR v_i IN 1..10 LOOP
    IF p_numbers[v_i] < 0 OR p_numbers[v_i] > 99 THEN
      RAISE EXCEPTION 'Numbers must be between 00 and 99';
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND status = 'active') THEN
    RAISE EXCEPTION 'Game must be active';
  END IF;

  INSERT INTO players (name, nickname)
  VALUES (TRIM(p_name), NULLIF(TRIM(p_nickname), ''))
  RETURNING id INTO v_player_id;

  INSERT INTO player_entries (player_id, game_id)
  VALUES (v_player_id, p_game_id)
  RETURNING id INTO v_entry_id;

  FOR v_i IN 1..10 LOOP
    INSERT INTO entry_numbers (entry_id, slot, number)
    VALUES (v_entry_id, v_i - 1, p_numbers[v_i]);
  END LOOP;

  PERFORM recalc_game_prize_pool(p_game_id);

  PERFORM log_audit('entry_created', 'player_entries', v_entry_id, NULL,
    jsonb_build_object(
      'player_id', v_player_id,
      'player_name', p_name,
      'game_id', p_game_id
    ));

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_create_game() TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_register_player_entry(UUID, TEXT, SMALLINT[], TEXT) TO authenticated;

ALTER FUNCTION rpc_create_game() OWNER TO postgres;
ALTER FUNCTION rpc_register_player_entry(UUID, TEXT, SMALLINT[], TEXT) OWNER TO postgres;
