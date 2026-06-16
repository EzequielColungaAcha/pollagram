-- 012_retroactive_matches.sql
-- Retroactive draw matching when players join or games become active.

CREATE OR REPLACE FUNCTION process_game_draw(p_game_id UUID, p_draw_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_dn RECORD;
  v_en RECORD;
  v_new_matches INTEGER := 0;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;

  IF NOT FOUND OR v_game.status != 'active' THEN
    RETURN 0;
  END IF;

  FOR v_dn IN
    SELECT dn.id AS draw_number_id, dn.number, dn.position
    FROM draw_numbers dn
    WHERE dn.draw_id = p_draw_id
    ORDER BY dn.position ASC
  LOOP
    IF EXISTS (
      SELECT 1 FROM matches m
      JOIN player_entries pe ON pe.id = m.entry_id
      WHERE m.draw_number_id = v_dn.draw_number_id
        AND pe.game_id = p_game_id
    ) THEN
      CONTINUE;
    END IF;

    SELECT en.id, en.entry_id INTO v_en
    FROM entry_numbers en
    JOIN player_entries pe ON pe.id = en.entry_id
    WHERE pe.game_id = p_game_id
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
BEGIN
  SELECT status INTO v_game_status FROM games WHERE id = p_game_id;
  IF v_game_status IS NULL OR v_game_status != 'active' THEN
    RETURN 0;
  END IF;

  FOR v_draw IN
    SELECT ld.id
    FROM lottery_draws ld
    WHERE NOT ld.is_invalidated
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

CREATE OR REPLACE FUNCTION process_draw_matches(p_draw_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_new_matches INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lottery_draws WHERE id = p_draw_id) THEN
    RETURN 0;
  END IF;

  FOR v_game IN
    SELECT id FROM games WHERE status = 'active'
  LOOP
    v_new_matches := v_new_matches + process_game_draw(v_game.id, p_draw_id);
  END LOOP;

  RETURN v_new_matches;
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
  v_retroactive_matches INTEGER;
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

  v_retroactive_matches := process_game_retroactive_matches(p_game_id);

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
  v_game_status game_status;
  v_retroactive_matches INTEGER;
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

  INSERT INTO player_entries (player_id, game_id)
  VALUES (p_player_id, p_game_id)
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
      'player_id', p_player_id,
      'game_id', p_game_id,
      'retroactive_matches', COALESCE(v_retroactive_matches, 0)
    ));

  RETURN v_entry_id;
END;
$$;

ALTER FUNCTION process_game_draw(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION process_game_retroactive_matches(UUID) OWNER TO postgres;
ALTER FUNCTION process_draw_matches(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_open_game(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_register_player_entry(UUID, TEXT, SMALLINT[], TEXT) OWNER TO postgres;
ALTER FUNCTION rpc_create_entry(UUID, UUID, SMALLINT[]) OWNER TO postgres;
