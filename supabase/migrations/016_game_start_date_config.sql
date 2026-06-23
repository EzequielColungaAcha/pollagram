-- 016_game_start_date_config.sql
-- Configurable start_date per game; app timezone GMT-3 (America/Argentina/Buenos_Aires).

CREATE OR REPLACE FUNCTION app_today()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
$$;

DROP FUNCTION IF EXISTS rpc_create_game(TEXT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION rpc_create_game(
  p_label TEXT DEFAULT NULL,
  p_entry_fee NUMERIC DEFAULT NULL,
  p_prize_percent NUMERIC DEFAULT NULL,
  p_start_date DATE DEFAULT NULL
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
  v_start_date DATE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_label := COALESCE(
    NULLIF(TRIM(p_label), ''),
    'Juego #' || (SELECT COUNT(*) + 1 FROM games)
  );

  SELECT * INTO v_settings FROM app_settings WHERE id = 1;

  v_entry_fee := COALESCE(p_entry_fee, v_settings.entry_fee);
  v_prize_percent := COALESCE(p_prize_percent, v_settings.prize_percent);
  v_start_date := COALESCE(p_start_date, app_today());

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
    v_label, v_start_date, v_start_date,
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
      'start_date', v_start_date,
      'entry_fee', v_entry_fee,
      'prize_percent', v_prize_percent,
      'rollover_in', v_rollover,
      'status', 'draft'
    ));

  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS rpc_update_game(UUID, TEXT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION rpc_update_game(
  p_game_id UUID,
  p_label TEXT DEFAULT NULL,
  p_entry_fee NUMERIC DEFAULT NULL,
  p_prize_percent NUMERIC DEFAULT NULL,
  p_start_date DATE DEFAULT NULL
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
  v_start_changed BOOLEAN := FALSE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;

  v_old := jsonb_build_object(
    'label', v_game.label,
    'start_date', v_game.start_date,
    'entry_fee', v_game.entry_fee,
    'prize_percent', v_game.prize_percent
  );

  IF p_label IS NOT NULL AND NULLIF(TRIM(p_label), '') IS NOT NULL THEN
    UPDATE games SET label = TRIM(p_label) WHERE id = p_game_id;
    v_new := v_new || jsonb_build_object('label', TRIM(p_label));
  END IF;

  IF p_start_date IS NOT NULL AND p_start_date != v_game.start_date THEN
    IF v_game.status IN ('closed', 'archived') THEN
      IF p_start_date > COALESCE(DATE(v_game.closed_at), v_game.end_date) THEN
        RAISE EXCEPTION 'Start date cannot be after game close date';
      END IF;
    END IF;

    UPDATE games SET
      start_date = p_start_date,
      end_date = GREATEST(end_date, p_start_date)
    WHERE id = p_game_id;

    v_new := v_new || jsonb_build_object('start_date', p_start_date);
    v_start_changed := TRUE;
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

  IF v_start_changed AND v_game.status = 'active' THEN
    PERFORM reprocess_game_matches(p_game_id);
  END IF;

  IF v_new != '{}'::JSONB THEN
    PERFORM log_audit('settings_changed', 'games', p_game_id, v_old, v_new);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION app_today() TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_create_game(TEXT, NUMERIC, NUMERIC, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_game(UUID, TEXT, NUMERIC, NUMERIC, DATE) TO authenticated;
ALTER FUNCTION app_today() OWNER TO postgres;
ALTER FUNCTION rpc_create_game(TEXT, NUMERIC, NUMERIC, DATE) OWNER TO postgres;
ALTER FUNCTION rpc_update_game(UUID, TEXT, NUMERIC, NUMERIC, DATE) OWNER TO postgres;
