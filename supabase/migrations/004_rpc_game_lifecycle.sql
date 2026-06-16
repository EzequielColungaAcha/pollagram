-- 004_rpc_game_lifecycle.sql

CREATE OR REPLACE FUNCTION rpc_create_player(
  p_name TEXT,
  p_nickname TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  INSERT INTO players (name, nickname)
  VALUES (TRIM(p_name), NULLIF(TRIM(p_nickname), ''))
  RETURNING id INTO v_id;

  PERFORM log_audit('player_created', 'players', v_id, NULL,
    jsonb_build_object('name', p_name, 'nickname', p_nickname));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_create_game(
  p_label TEXT,
  p_start_date DATE,
  p_end_date DATE
)
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

  INSERT INTO games (label, start_date, end_date, entry_fee, prize_percent, rollover_in, status)
  VALUES (p_label, p_start_date, p_end_date, v_settings.entry_fee, v_settings.prize_percent, v_rollover, 'draft')
  RETURNING id INTO v_id;

  IF v_rollover > 0 THEN
    INSERT INTO prize_rollovers (from_game_id, to_game_id, amount)
    SELECT g.id, v_id, v_rollover FROM games g
    WHERE g.status = 'closed' AND NOT EXISTS (SELECT 1 FROM winners w WHERE w.game_id = g.id)
    ORDER BY g.closed_at DESC NULLS LAST LIMIT 1;
  END IF;

  PERFORM log_audit('game_created', 'games', v_id, NULL,
    jsonb_build_object('label', p_label, 'rollover_in', v_rollover));

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

  IF EXISTS (SELECT 1 FROM games WHERE status = 'active' AND id != p_game_id) THEN
    RAISE EXCEPTION 'Only one active game allowed';
  END IF;

  UPDATE games SET status = 'active' WHERE id = p_game_id AND status = 'draft';

  PERFORM log_audit('game_opened', 'games', p_game_id, NULL, jsonb_build_object('status', 'active'));
END;
$$;

CREATE OR REPLACE FUNCTION rpc_close_game(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_has_winners BOOLEAN;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;

  IF v_game.status != 'active' THEN
    RAISE EXCEPTION 'Game must be active to close';
  END IF;

  SELECT EXISTS (SELECT 1 FROM player_entries WHERE game_id = p_game_id AND is_winner = TRUE)
  INTO v_has_winners;

  UPDATE games SET status = 'closed', closed_at = NOW() WHERE id = p_game_id;

  IF NOT v_has_winners THEN
    PERFORM log_audit('game_closed', 'games', p_game_id, NULL,
      jsonb_build_object('reason', 'no_winners', 'rollover_amount', v_game.prize_pool));
  END IF;

  RETURN jsonb_build_object('game_id', p_game_id, 'rollover', CASE WHEN v_has_winners THEN 0 ELSE v_game.prize_pool END);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_archive_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE games SET status = 'archived' WHERE id = p_game_id AND status = 'closed';

  PERFORM log_audit('game_archived', 'games', p_game_id, NULL, jsonb_build_object('status', 'archived'));
END;
$$;

CREATE OR REPLACE FUNCTION rpc_create_entry(
  p_player_id UUID,
  p_game_id UUID,
  p_numbers SMALLINT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND status IN ('draft', 'active')) THEN
    RAISE EXCEPTION 'Game must be draft or active';
  END IF;

  INSERT INTO player_entries (player_id, game_id)
  VALUES (p_player_id, p_game_id)
  RETURNING id INTO v_entry_id;

  FOR v_i IN 1..10 LOOP
    INSERT INTO entry_numbers (entry_id, slot, number)
    VALUES (v_entry_id, v_i - 1, p_numbers[v_i]);
  END LOOP;

  PERFORM recalc_game_prize_pool(p_game_id);

  PERFORM log_audit('entry_created', 'player_entries', v_entry_id, NULL,
    jsonb_build_object('player_id', p_player_id, 'game_id', p_game_id));

  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_edit_entry_numbers(
  p_entry_id UUID,
  p_numbers SMALLINT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry player_entries%ROWTYPE;
  v_i INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_entry FROM player_entries WHERE id = p_entry_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM matches m JOIN entry_numbers en ON en.id = m.entry_number_id WHERE en.entry_id = p_entry_id) THEN
    RAISE EXCEPTION 'Cannot edit numbers after draws have been entered';
  END IF;

  IF array_length(p_numbers, 1) != 10 THEN
    RAISE EXCEPTION 'Exactly 10 numbers required';
  END IF;

  DELETE FROM entry_numbers WHERE entry_id = p_entry_id;

  FOR v_i IN 1..10 LOOP
    INSERT INTO entry_numbers (entry_id, slot, number)
    VALUES (p_entry_id, v_i - 1, p_numbers[v_i]);
  END LOOP;

  PERFORM log_audit('numbers_edited', 'player_entries', p_entry_id, NULL,
    jsonb_build_object('numbers', p_numbers));
END;
$$;

CREATE OR REPLACE FUNCTION rpc_update_settings(
  p_entry_fee NUMERIC,
  p_prize_percent NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT jsonb_build_object('entry_fee', entry_fee, 'prize_percent', prize_percent)
  INTO v_old FROM app_settings WHERE id = 1;

  UPDATE app_settings SET
    entry_fee = p_entry_fee,
    prize_percent = p_prize_percent,
    updated_at = NOW()
  WHERE id = 1;

  UPDATE games SET entry_fee = p_entry_fee, prize_percent = p_prize_percent
  WHERE status IN ('draft', 'active');

  PERFORM recalc_game_prize_pool(g.id)
  FROM games g WHERE g.status = 'active';

  PERFORM log_audit('settings_changed', 'app_settings', NULL, v_old,
    jsonb_build_object('entry_fee', p_entry_fee, 'prize_percent', p_prize_percent));
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_create_player TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_create_game TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_open_game TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_close_game TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_archive_game TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_create_entry TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_edit_entry_numbers TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_settings TO authenticated;

-- Leaderboard view
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  pe.id AS entry_id,
  pe.game_id,
  pe.matched_count,
  pe.remaining_count,
  pe.completion_pct,
  pe.is_winner,
  pe.won_at,
  p.id AS player_id,
  p.name AS player_name,
  p.nickname AS player_nickname,
  ROW_NUMBER() OVER (
    PARTITION BY pe.game_id
    ORDER BY pe.matched_count DESC, pe.remaining_count ASC, pe.won_at ASC NULLS LAST, p.name ASC
  ) AS rank
FROM player_entries pe
JOIN players p ON p.id = pe.player_id;

GRANT SELECT ON leaderboard_view TO anon, authenticated;
