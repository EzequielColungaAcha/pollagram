-- 015_game_draft_lifecycle.sql
-- Create games as draft; activate manually to show publicly.

CREATE OR REPLACE FUNCTION rpc_create_game(
  p_label TEXT DEFAULT NULL,
  p_entry_fee NUMERIC DEFAULT NULL,
  p_prize_percent NUMERIC DEFAULT NULL
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
  v_label TEXT;
  v_entry_fee NUMERIC(12, 2);
  v_prize_percent NUMERIC(5, 4);
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_label := COALESCE(
    NULLIF(TRIM(p_label), ''),
    'Juego #' || (SELECT COUNT(*) + 1 FROM games)
  );

  SELECT * INTO v_settings FROM app_settings WHERE id = 1;

  v_entry_fee := COALESCE(p_entry_fee, v_settings.entry_fee);
  v_prize_percent := COALESCE(p_prize_percent, v_settings.prize_percent);

  IF v_entry_fee < 0 THEN
    RAISE EXCEPTION 'Entry fee must be >= 0';
  END IF;
  IF v_prize_percent <= 0 OR v_prize_percent > 1 THEN
    RAISE EXCEPTION 'Prize percent must be between 0 and 1';
  END IF;

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
    v_label, CURRENT_DATE, CURRENT_DATE,
    v_entry_fee, v_prize_percent, v_rollover, 'draft'
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
    jsonb_build_object(
      'label', v_label,
      'entry_fee', v_entry_fee,
      'prize_percent', v_prize_percent,
      'rollover_in', v_rollover,
      'status', 'draft'
    ));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_open_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retroactive_matches INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF EXISTS (SELECT 1 FROM games WHERE status = 'active' AND id != p_game_id) THEN
    RAISE EXCEPTION 'Ya hay un juego activo. Ciérrelo o archívelo antes de activar otro.';
  END IF;

  UPDATE games SET status = 'active' WHERE id = p_game_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game must be draft to open';
  END IF;

  v_retroactive_matches := process_game_retroactive_matches(p_game_id);

  PERFORM log_audit('game_opened', 'games', p_game_id, NULL,
    jsonb_build_object('status', 'active', 'retroactive_matches', v_retroactive_matches));
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
  v_game_status game_status;
  v_retroactive_matches INTEGER := 0;
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

  SELECT status INTO v_game_status FROM games WHERE id = p_game_id;
  IF v_game_status IS NULL OR v_game_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'Game must be draft or active';
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

  IF v_game_status = 'active' THEN
    v_retroactive_matches := process_game_retroactive_matches(p_game_id);
  END IF;

  PERFORM log_audit('entry_created', 'player_entries', v_entry_id, NULL,
    jsonb_build_object(
      'player_id', v_player_id,
      'player_name', p_name,
      'game_id', p_game_id,
      'retroactive_matches', v_retroactive_matches
    ));

  RETURN v_entry_id;
END;
$$;

ALTER FUNCTION rpc_create_game(TEXT, NUMERIC, NUMERIC) OWNER TO postgres;
ALTER FUNCTION rpc_open_game(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_register_player_entry(UUID, TEXT, SMALLINT[], TEXT) OWNER TO postgres;
