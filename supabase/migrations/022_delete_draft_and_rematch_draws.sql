-- 022_delete_draft_and_rematch_draws.sql
-- Draft-only game delete; rematch all active games or a single draw.

CREATE OR REPLACE FUNCTION rpc_delete_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_player_id UUID;
  v_remaining INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF v_game.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft games can be deleted';
  END IF;

  IF EXISTS (SELECT 1 FROM prize_rollovers WHERE from_game_id = p_game_id) THEN
    RAISE EXCEPTION 'Cannot delete a game that is a rollover source';
  END IF;

  PERFORM log_audit('settings_changed', 'games', p_game_id, NULL,
    jsonb_build_object(
      'action', 'game_deleted',
      'label', v_game.label,
      'status', v_game.status,
      'player_count', v_game.player_count
    ));

  DELETE FROM winners WHERE game_id = p_game_id;

  DELETE FROM matches
  WHERE entry_id IN (SELECT id FROM player_entries WHERE game_id = p_game_id);

  FOR v_player_id IN
    SELECT DISTINCT player_id FROM player_entries WHERE game_id = p_game_id
  LOOP
    DELETE FROM player_entries
    WHERE game_id = p_game_id AND player_id = v_player_id;

    SELECT COUNT(*) INTO v_remaining
    FROM player_entries
    WHERE player_id = v_player_id;

    IF v_remaining = 0 THEN
      DELETE FROM players WHERE id = v_player_id;
    END IF;
  END LOOP;

  DELETE FROM prize_rollovers WHERE to_game_id = p_game_id;

  UPDATE lottery_draws SET game_id = NULL WHERE game_id = p_game_id;

  DELETE FROM games WHERE id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_reprocess_active_matches()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_result JSONB;
  v_games_processed INTEGER := 0;
  v_new_matches INTEGER := 0;
  v_game_matches INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  FOR v_game IN
    SELECT id FROM games WHERE status = 'active' ORDER BY created_at ASC
  LOOP
    v_result := reprocess_game_matches(v_game.id);
    v_games_processed := v_games_processed + 1;
    v_game_matches := COALESCE((v_result ->> 'new_matches')::INTEGER, 0);
    v_new_matches := v_new_matches + v_game_matches;
  END LOOP;

  PERFORM log_audit('settings_changed', 'games', NULL, NULL,
    jsonb_build_object(
      'action', 'matches_reprocessed',
      'scope', 'all_active_games',
      'games_processed', v_games_processed,
      'new_matches', v_new_matches
    ));

  RETURN jsonb_build_object(
    'games_processed', v_games_processed,
    'new_matches', v_new_matches
  );
END;
$$;

CREATE OR REPLACE FUNCTION rpc_reprocess_draw(p_draw_id UUID)
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
  v_new_matches INTEGER := 0;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_draw FROM lottery_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draw not found';
  END IF;

  IF v_draw.is_invalidated THEN
    RAISE EXCEPTION 'Cannot reprocess an invalidated draw';
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
        SELECT pe.id FROM player_entries pe WHERE pe.game_id = v_game_id
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

  v_new_matches := process_draw_matches(p_draw_id);

  PERFORM log_audit('settings_changed', 'lottery_draws', p_draw_id, NULL,
    jsonb_build_object(
      'action', 'draw_reprocessed',
      'draw_date', v_draw.draw_date,
      'new_matches', v_new_matches,
      'affected_games', v_affected_games
    ));

  RETURN jsonb_build_object(
    'draw_id', p_draw_id,
    'new_matches', v_new_matches
  );
END;
$$;

ALTER FUNCTION rpc_delete_game(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_reprocess_active_matches() OWNER TO postgres;
ALTER FUNCTION rpc_reprocess_draw(UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION rpc_delete_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_reprocess_active_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_reprocess_draw(UUID) TO authenticated;
