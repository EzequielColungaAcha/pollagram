-- 003_rpc_helpers_and_match_processor.sql

CREATE OR REPLACE FUNCTION log_audit(
  p_action audit_action,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_value, p_new_value);
END;
$$;

CREATE OR REPLACE FUNCTION recalc_game_prize_pool(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  SELECT COUNT(*) INTO v_count FROM player_entries WHERE game_id = p_game_id;

  UPDATE games SET
    player_count = v_count,
    total_collected = v_count * v_game.entry_fee,
    prize_pool = (v_count * v_game.entry_fee * v_game.prize_percent) + v_game.rollover_in
  WHERE id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_entry_progress(p_entry_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_matched
  FROM matches m
  JOIN entry_numbers en ON en.id = m.entry_number_id
  WHERE en.entry_id = p_entry_id;

  UPDATE player_entries SET
    matched_count = v_matched,
    remaining_count = 10 - v_matched,
    completion_pct = v_matched * 10.0
  WHERE id = p_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION distribute_prizes(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_winner_count INTEGER;
  v_share NUMERIC(14, 2);
  v_total_distributed NUMERIC(14, 2);
  v_remainder_cents INTEGER;
  v_winner RECORD;
  v_idx INTEGER := 0;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;

  SELECT COUNT(*) INTO v_winner_count
  FROM player_entries
  WHERE game_id = p_game_id AND is_winner = TRUE;

  IF v_winner_count = 0 THEN
    RETURN;
  END IF;

  v_share := FLOOR((v_game.prize_pool / v_winner_count) * 100) / 100;
  v_total_distributed := v_share * v_winner_count;
  v_remainder_cents := ROUND((v_game.prize_pool - v_total_distributed) * 100)::INTEGER;

  FOR v_winner IN
    SELECT pe.id AS entry_id, pe.won_at, p.name
    FROM player_entries pe
    JOIN players p ON p.id = pe.player_id
    WHERE pe.game_id = p_game_id AND pe.is_winner = TRUE
    ORDER BY pe.won_at ASC NULLS LAST, p.name ASC
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO winners (entry_id, game_id, prize_amount, won_at)
    VALUES (
      v_winner.entry_id,
      p_game_id,
      v_share + CASE WHEN v_idx <= v_remainder_cents THEN 0.01 ELSE 0 END,
      COALESCE(v_winner.won_at, NOW())
    )
    ON CONFLICT (entry_id, game_id) DO UPDATE SET prize_amount = EXCLUDED.prize_amount;

    PERFORM log_audit('winner_recorded', 'player_entries', v_winner.entry_id,
      NULL, jsonb_build_object('prize_amount', v_share));
  END LOOP;

  UPDATE games SET final_awarded = v_game.prize_pool WHERE id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION process_draw_matches(p_draw_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw lottery_draws%ROWTYPE;
  v_dn RECORD;
  v_en RECORD;
  v_new_matches INTEGER := 0;
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_draw FROM lottery_draws WHERE id = p_draw_id;
  SELECT * INTO v_game FROM games WHERE id = v_draw.game_id FOR UPDATE;

  IF v_game.status != 'active' THEN
    RAISE EXCEPTION 'Draws only allowed for active games';
  END IF;

  FOR v_dn IN
    SELECT dn.id AS draw_number_id, dn.number, dn.position
    FROM draw_numbers dn
    WHERE dn.draw_id = p_draw_id
    ORDER BY dn.position ASC
  LOOP
    SELECT en.id, en.entry_id INTO v_en
    FROM entry_numbers en
    JOIN player_entries pe ON pe.id = en.entry_id
    WHERE pe.game_id = v_draw.game_id
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

  IF EXISTS (SELECT 1 FROM player_entries WHERE game_id = v_draw.game_id AND is_winner = TRUE) THEN
    PERFORM distribute_prizes(v_draw.game_id);
    UPDATE games SET status = 'closed', closed_at = NOW() WHERE id = v_draw.game_id AND status = 'active';
    PERFORM log_audit('game_closed', 'games', v_draw.game_id, NULL,
      jsonb_build_object('reason', 'winner_detected'));
  END IF;

  RETURN v_new_matches;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_enter_draw(
  p_game_id UUID,
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

  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND status = 'active') THEN
    RAISE EXCEPTION 'Game must be active';
  END IF;

  INSERT INTO lottery_draws (game_id, draw_date, entered_by)
  VALUES (p_game_id, p_draw_date, auth.uid())
  RETURNING id INTO v_draw_id;

  FOR v_i IN 1..20 LOOP
    INSERT INTO draw_numbers (draw_id, position, number)
    VALUES (v_draw_id, v_i - 1, p_numbers[v_i]);
  END LOOP;

  v_match_count := process_draw_matches(v_draw_id);

  PERFORM log_audit('draw_entered', 'lottery_draws', v_draw_id, NULL,
    jsonb_build_object('game_id', p_game_id, 'draw_date', p_draw_date, 'new_matches', v_match_count));

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
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_draw FROM lottery_draws WHERE id = p_draw_id FOR UPDATE;
  IF v_draw.is_invalidated THEN
    RAISE EXCEPTION 'Draw already invalidated';
  END IF;

  v_game_id := v_draw.game_id;

  DELETE FROM winners WHERE game_id = v_game_id
    AND entry_id IN (SELECT DISTINCT entry_id FROM matches WHERE draw_id = p_draw_id);

  DELETE FROM matches WHERE draw_id = p_draw_id;

  FOR v_entry_id IN
    SELECT DISTINCT pe.id FROM player_entries pe WHERE pe.game_id = v_game_id
  LOOP
    PERFORM update_entry_progress(v_entry_id);
    UPDATE player_entries SET is_winner = FALSE, won_at = NULL
    WHERE id = v_entry_id AND NOT EXISTS (
      SELECT 1 FROM matches m JOIN entry_numbers en ON en.id = m.entry_number_id
      WHERE en.entry_id = v_entry_id
    ) OR matched_count < 10;
  END LOOP;

  UPDATE player_entries SET is_winner = (matched_count = 10), won_at = NULL
  WHERE game_id = v_game_id AND matched_count = 10 AND is_winner = TRUE;

  UPDATE lottery_draws SET is_invalidated = TRUE WHERE id = p_draw_id;

  UPDATE games SET status = 'active', closed_at = NULL, final_awarded = NULL
  WHERE id = v_game_id AND status = 'closed';

  PERFORM log_audit('draw_invalidated', 'lottery_draws', p_draw_id, NULL,
    jsonb_build_object('game_id', v_game_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_enter_draw TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_invalidate_draw TO authenticated;
