-- 014_draw_date_window.sql
-- Only apply draws within [start_date, DATE(closed_at)] to each game.

CREATE OR REPLACE FUNCTION draw_applies_to_game(
  p_game_id UUID,
  p_draw_id UUID,
  p_close_date DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM lottery_draws ld
    JOIN games g ON g.id = p_game_id
    WHERE ld.id = p_draw_id
      AND NOT ld.is_invalidated
      AND ld.draw_date >= g.start_date
      AND (
        COALESCE(p_close_date, DATE(g.closed_at)) IS NULL
        OR ld.draw_date <= COALESCE(p_close_date, DATE(g.closed_at))
      )
  );
$$;

CREATE OR REPLACE FUNCTION process_game_draw(p_game_id UUID, p_draw_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_dn RECORD;
  v_pe RECORD;
  v_en RECORD;
  v_new_matches INTEGER := 0;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;

  IF NOT FOUND OR v_game.status != 'active' THEN
    RETURN 0;
  END IF;

  IF NOT draw_applies_to_game(p_game_id, p_draw_id) THEN
    RETURN 0;
  END IF;

  FOR v_dn IN
    SELECT dn.id AS draw_number_id, dn.number, dn.position
    FROM draw_numbers dn
    WHERE dn.draw_id = p_draw_id
    ORDER BY dn.position ASC
  LOOP
    FOR v_pe IN
      SELECT id FROM player_entries WHERE game_id = p_game_id
    LOOP
      SELECT en.id, en.entry_id INTO v_en
      FROM entry_numbers en
      WHERE en.entry_id = v_pe.id
        AND en.number = v_dn.number
        AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.entry_number_id = en.id)
      ORDER BY en.slot ASC
      LIMIT 1;

      IF FOUND THEN
        INSERT INTO matches (entry_id, entry_number_id, draw_id, draw_number_id)
        VALUES (v_en.entry_id, v_en.id, p_draw_id, v_dn.draw_number_id);

        PERFORM update_entry_progress(v_en.entry_id);
        v_new_matches := v_new_matches + 1;

        UPDATE player_entries SET
          is_winner = TRUE,
          won_at = COALESCE(won_at, NOW())
        WHERE id = v_en.entry_id
          AND matched_count = 10
          AND is_winner = FALSE;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (SELECT 1 FROM player_entries WHERE game_id = p_game_id AND is_winner = TRUE) THEN
    PERFORM distribute_prizes(p_game_id);
    UPDATE games SET status = 'closed', closed_at = NOW()
    WHERE id = p_game_id AND status = 'active';
    PERFORM log_audit('game_closed', 'games', p_game_id, NULL,
      jsonb_build_object('reason', 'winner_detected'));
  END IF;

  RETURN v_new_matches;
END;
$$;

CREATE OR REPLACE FUNCTION process_game_retroactive_matches(p_game_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw RECORD;
  v_new_matches INTEGER := 0;
  v_game_status game_status;
  v_start_date DATE;
BEGIN
  SELECT status, start_date INTO v_game_status, v_start_date
  FROM games WHERE id = p_game_id;

  IF v_game_status IS NULL OR v_game_status != 'active' THEN
    RETURN 0;
  END IF;

  FOR v_draw IN
    SELECT ld.id
    FROM lottery_draws ld
    WHERE NOT ld.is_invalidated
      AND ld.draw_date >= v_start_date
    ORDER BY ld.draw_date ASC, ld.created_at ASC
  LOOP
    v_new_matches := v_new_matches + process_game_draw(p_game_id, v_draw.id);

    SELECT status INTO v_game_status FROM games WHERE id = p_game_id;
    IF v_game_status != 'active' THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN v_new_matches;
END;
$$;

CREATE OR REPLACE FUNCTION reprocess_game_matches(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_saved_status game_status;
  v_close_date DATE;
  v_draw RECORD;
  v_new_matches INTEGER := 0;
  v_has_winners BOOLEAN;
  v_current_status game_status;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM player_entries WHERE game_id = p_game_id) THEN
    RETURN jsonb_build_object('game_id', p_game_id, 'new_matches', 0, 'skipped', true);
  END IF;

  v_saved_status := v_game.status;
  v_close_date := DATE(v_game.closed_at);

  DELETE FROM winners WHERE game_id = p_game_id;
  DELETE FROM matches
  WHERE entry_id IN (SELECT id FROM player_entries WHERE game_id = p_game_id);

  UPDATE player_entries SET
    matched_count = 0,
    remaining_count = 10,
    completion_pct = 0,
    is_winner = FALSE,
    won_at = NULL
  WHERE game_id = p_game_id;

  UPDATE games SET
    status = 'active',
    closed_at = NULL,
    final_awarded = NULL
  WHERE id = p_game_id;

  FOR v_draw IN
    SELECT ld.id
    FROM lottery_draws ld
    WHERE NOT ld.is_invalidated
      AND ld.draw_date >= v_game.start_date
      AND (v_close_date IS NULL OR ld.draw_date <= v_close_date)
    ORDER BY ld.draw_date ASC, ld.created_at ASC
  LOOP
    v_new_matches := v_new_matches + process_game_draw(p_game_id, v_draw.id);

    SELECT status INTO v_current_status FROM games WHERE id = p_game_id;
    IF v_current_status != 'active' THEN
      EXIT;
    END IF;
  END LOOP;

  SELECT EXISTS (SELECT 1 FROM player_entries WHERE game_id = p_game_id AND is_winner = TRUE)
  INTO v_has_winners;

  IF v_saved_status = 'draft' THEN
    UPDATE games SET status = 'draft', closed_at = NULL WHERE id = p_game_id;
  ELSIF v_has_winners THEN
    IF v_saved_status = 'archived' THEN
      UPDATE games SET status = 'archived' WHERE id = p_game_id;
    END IF;
  ELSIF v_saved_status IN ('closed', 'archived') THEN
    UPDATE games SET status = 'closed', closed_at = NOW() WHERE id = p_game_id;
    IF v_saved_status = 'archived' THEN
      UPDATE games SET status = 'archived' WHERE id = p_game_id;
    END IF;
  END IF;

  PERFORM log_audit('settings_changed', 'games', p_game_id, NULL,
    jsonb_build_object(
      'action', 'matches_reprocessed',
      'original_status', v_saved_status,
      'new_matches', v_new_matches,
      'has_winners', v_has_winners
    ));

  RETURN jsonb_build_object(
    'game_id', p_game_id,
    'new_matches', v_new_matches,
    'has_winners', v_has_winners
  );
END;
$$;

DO $$
DECLARE
  v_game RECORD;
BEGIN
  FOR v_game IN
    SELECT g.id FROM games g
    WHERE EXISTS (SELECT 1 FROM player_entries pe WHERE pe.game_id = g.id)
  LOOP
    PERFORM reprocess_game_matches(v_game.id);
  END LOOP;
END $$;

ALTER FUNCTION draw_applies_to_game(UUID, UUID, DATE) OWNER TO postgres;
ALTER FUNCTION process_game_draw(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION process_game_retroactive_matches(UUID) OWNER TO postgres;
ALTER FUNCTION reprocess_game_matches(UUID) OWNER TO postgres;
