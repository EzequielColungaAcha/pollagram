-- 010_global_draws.sql
-- One daily draw applies to all active games.

ALTER TABLE lottery_draws ALTER COLUMN game_id DROP NOT NULL;

ALTER TABLE lottery_draws DROP CONSTRAINT IF EXISTS lottery_draws_game_id_draw_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS draws_one_date_idx
  ON lottery_draws (draw_date)
  WHERE NOT is_invalidated;

CREATE OR REPLACE FUNCTION process_draw_matches(p_draw_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw lottery_draws%ROWTYPE;
  v_game RECORD;
  v_dn RECORD;
  v_en RECORD;
  v_new_matches INTEGER := 0;
BEGIN
  SELECT * INTO v_draw FROM lottery_draws WHERE id = p_draw_id;

  FOR v_game IN
    SELECT id FROM games WHERE status = 'active'
  LOOP
    PERFORM 1 FROM games WHERE id = v_game.id FOR UPDATE;

    FOR v_dn IN
      SELECT dn.id AS draw_number_id, dn.number, dn.position
      FROM draw_numbers dn
      WHERE dn.draw_id = p_draw_id
      ORDER BY dn.position ASC
    LOOP
      SELECT en.id, en.entry_id INTO v_en
      FROM entry_numbers en
      JOIN player_entries pe ON pe.id = en.entry_id
      WHERE pe.game_id = v_game.id
        AND en.number = v_dn.number
        AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.entry_number_id = en.id)
      ORDER BY pe.created_at ASC, en.slot ASC
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

    IF EXISTS (SELECT 1 FROM player_entries WHERE game_id = v_game.id AND is_winner = TRUE) THEN
      PERFORM distribute_prizes(v_game.id);
      UPDATE games SET status = 'closed', closed_at = NOW()
      WHERE id = v_game.id AND status = 'active';
      PERFORM log_audit('game_closed', 'games', v_game.id, NULL,
        jsonb_build_object('reason', 'winner_detected'));
    END IF;
  END LOOP;

  RETURN v_new_matches;
END;
$$;

DROP FUNCTION IF EXISTS rpc_enter_draw(UUID, DATE, SMALLINT[]);

CREATE OR REPLACE FUNCTION rpc_enter_draw(
  p_draw_date DATE,
  p_numbers SMALLINT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw_id UUID;
  v_i INTEGER;
  v_match_count INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF array_length(p_numbers, 1) != 20 THEN
    RAISE EXCEPTION 'Exactly 20 numbers required';
  END IF;

  FOR v_i IN 1..20 LOOP
    IF p_numbers[v_i] < 0 OR p_numbers[v_i] > 99 THEN
      RAISE EXCEPTION 'Numbers must be between 00 and 99';
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM games WHERE status = 'active') THEN
    RAISE EXCEPTION 'At least one active game required';
  END IF;

  INSERT INTO lottery_draws (game_id, draw_date, entered_by)
  VALUES (NULL, p_draw_date, auth.uid())
  RETURNING id INTO v_draw_id;

  FOR v_i IN 1..20 LOOP
    INSERT INTO draw_numbers (draw_id, position, number)
    VALUES (v_draw_id, v_i - 1, p_numbers[v_i]);
  END LOOP;

  v_match_count := process_draw_matches(v_draw_id);

  PERFORM log_audit('draw_entered', 'lottery_draws', v_draw_id, NULL,
    jsonb_build_object('draw_date', p_draw_date, 'new_matches', v_match_count, 'scope', 'all_active_games'));

  RETURN jsonb_build_object('draw_id', v_draw_id, 'new_matches', v_match_count);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_invalidate_draw(p_draw_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw lottery_draws%ROWTYPE;
  v_game_id UUID;
  v_entry_id UUID;
  v_affected_games UUID[];
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_draw FROM lottery_draws WHERE id = p_draw_id FOR UPDATE;
  IF v_draw.is_invalidated THEN
    RAISE EXCEPTION 'Draw already invalidated';
  END IF;

  SELECT ARRAY_AGG(DISTINCT pe.game_id) INTO v_affected_games
  FROM matches m
  JOIN player_entries pe ON pe.id = m.entry_id
  WHERE m.draw_id = p_draw_id;

  DELETE FROM winners
  WHERE entry_id IN (SELECT DISTINCT entry_id FROM matches WHERE draw_id = p_draw_id);

  DELETE FROM matches WHERE draw_id = p_draw_id;

  IF v_affected_games IS NOT NULL THEN
    FOREACH v_game_id IN ARRAY v_affected_games LOOP
      FOR v_entry_id IN
        SELECT DISTINCT pe.id FROM player_entries pe WHERE pe.game_id = v_game_id
      LOOP
        PERFORM update_entry_progress(v_entry_id);
        UPDATE player_entries SET is_winner = FALSE, won_at = NULL
        WHERE id = v_entry_id
          AND (
            NOT EXISTS (
              SELECT 1 FROM matches m
              JOIN entry_numbers en ON en.id = m.entry_number_id
              WHERE en.entry_id = v_entry_id
            )
            OR matched_count < 10
          );
      END LOOP;

      UPDATE player_entries SET is_winner = (matched_count = 10), won_at = NULL
      WHERE game_id = v_game_id AND matched_count = 10;

      UPDATE games SET status = 'active', closed_at = NULL, final_awarded = NULL
      WHERE id = v_game_id AND status = 'closed'
        AND NOT EXISTS (SELECT 1 FROM player_entries WHERE game_id = v_game_id AND is_winner = TRUE);
    END LOOP;
  END IF;

  UPDATE lottery_draws SET is_invalidated = TRUE WHERE id = p_draw_id;

  PERFORM log_audit('draw_invalidated', 'lottery_draws', p_draw_id, NULL,
    jsonb_build_object('affected_games', v_affected_games));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_enter_draw(DATE, SMALLINT[]) TO authenticated;
ALTER FUNCTION rpc_enter_draw(DATE, SMALLINT[]) OWNER TO postgres;
