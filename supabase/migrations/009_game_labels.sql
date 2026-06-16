-- 009_game_labels.sql
-- Optional label on create with auto-generated fallback.

DROP FUNCTION IF EXISTS rpc_create_game();

CREATE OR REPLACE FUNCTION rpc_create_game(p_label TEXT DEFAULT NULL)
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
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  v_label := COALESCE(
    NULLIF(TRIM(p_label), ''),
    'Juego #' || (SELECT COUNT(*) + 1 FROM games)
  );

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
    v_label, CURRENT_DATE, CURRENT_DATE,
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
    jsonb_build_object('label', v_label, 'rollover_in', v_rollover, 'status', 'active'));

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_create_game(TEXT) TO authenticated;
ALTER FUNCTION rpc_create_game(TEXT) OWNER TO postgres;
