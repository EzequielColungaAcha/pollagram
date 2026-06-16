-- 011_game_update_rpc.sql
-- Per-game economics on create; update game name/fee/percent.

DROP FUNCTION IF EXISTS rpc_create_game(TEXT);

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
    v_entry_fee, v_prize_percent, v_rollover, 'active'
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
      'status', 'active'
    ));

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_update_game(
  p_game_id UUID,
  p_label TEXT DEFAULT NULL,
  p_entry_fee NUMERIC DEFAULT NULL,
  p_prize_percent NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_old JSONB;
  v_new JSONB := '{}'::JSONB;
  v_recalc BOOLEAN := FALSE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;

  v_old := jsonb_build_object(
    'label', v_game.label,
    'entry_fee', v_game.entry_fee,
    'prize_percent', v_game.prize_percent
  );

  IF p_label IS NOT NULL AND NULLIF(TRIM(p_label), '') IS NOT NULL THEN
    UPDATE games SET label = TRIM(p_label) WHERE id = p_game_id;
    v_new := v_new || jsonb_build_object('label', TRIM(p_label));
  END IF;

  IF p_entry_fee IS NOT NULL THEN
    IF p_entry_fee < 0 THEN RAISE EXCEPTION 'Entry fee must be >= 0'; END IF;
    UPDATE games SET entry_fee = p_entry_fee WHERE id = p_game_id;
    v_new := v_new || jsonb_build_object('entry_fee', p_entry_fee);
    v_recalc := TRUE;
  END IF;

  IF p_prize_percent IS NOT NULL THEN
    IF p_prize_percent <= 0 OR p_prize_percent > 1 THEN
      RAISE EXCEPTION 'Prize percent must be between 0 and 1';
    END IF;
    UPDATE games SET prize_percent = p_prize_percent WHERE id = p_game_id;
    v_new := v_new || jsonb_build_object('prize_percent', p_prize_percent);
    v_recalc := TRUE;
  END IF;

  IF v_recalc THEN
    PERFORM recalc_game_prize_pool(p_game_id);
  END IF;

  IF v_new != '{}'::JSONB THEN
    PERFORM log_audit('settings_changed', 'games', p_game_id, v_old, v_new);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_create_game(TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_game(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated;
ALTER FUNCTION rpc_create_game(TEXT, NUMERIC, NUMERIC) OWNER TO postgres;
ALTER FUNCTION rpc_update_game(UUID, TEXT, NUMERIC, NUMERIC) OWNER TO postgres;
