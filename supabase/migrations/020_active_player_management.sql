-- 020_active_player_management.sql
-- Allow editing and deleting player entries while a game is draft or active.

CREATE OR REPLACE FUNCTION rpc_update_player_entry(
  p_entry_id UUID,
  p_name TEXT,
  p_numbers SMALLINT[],
  p_nickname TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry player_entries%ROWTYPE;
  v_game games%ROWTYPE;
  v_player players%ROWTYPE;
  v_old_player JSONB;
  v_old_numbers SMALLINT[];
  v_i INTEGER;
  v_numbers_changed BOOLEAN;
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

  SELECT * INTO v_entry FROM player_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;

  SELECT * INTO v_game FROM games WHERE id = v_entry.game_id FOR UPDATE;
  IF v_game.status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'Can only edit players in draft or active games';
  END IF;

  SELECT * INTO v_player FROM players WHERE id = v_entry.player_id FOR UPDATE;

  v_old_player := jsonb_build_object(
    'name', v_player.name,
    'nickname', v_player.nickname
  );

  SELECT array_agg(number ORDER BY slot)
  INTO v_old_numbers
  FROM entry_numbers
  WHERE entry_id = p_entry_id;

  v_numbers_changed := v_old_numbers IS DISTINCT FROM p_numbers;

  UPDATE players SET
    name = TRIM(p_name),
    nickname = NULLIF(TRIM(p_nickname), '')
  WHERE id = v_entry.player_id;

  IF v_old_player IS DISTINCT FROM jsonb_build_object(
    'name', TRIM(p_name),
    'nickname', NULLIF(TRIM(p_nickname), '')
  ) THEN
    PERFORM log_audit('player_updated', 'players', v_entry.player_id, v_old_player,
      jsonb_build_object(
        'name', TRIM(p_name),
        'nickname', NULLIF(TRIM(p_nickname), '')
      ));
  END IF;

  IF v_numbers_changed THEN
    DELETE FROM entry_numbers WHERE entry_id = p_entry_id;

    FOR v_i IN 1..10 LOOP
      INSERT INTO entry_numbers (entry_id, slot, number)
      VALUES (p_entry_id, v_i - 1, p_numbers[v_i]);
    END LOOP;

    PERFORM log_audit('numbers_edited', 'player_entries', p_entry_id,
      jsonb_build_object('numbers', v_old_numbers),
      jsonb_build_object('numbers', p_numbers));

    IF v_game.status = 'active' THEN
      PERFORM reprocess_game_matches(v_entry.game_id);
    END IF;
  END IF;

  PERFORM recalc_game_prize_pool(v_entry.game_id);
END;
$$;

CREATE OR REPLACE FUNCTION rpc_delete_player_entry(p_entry_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry player_entries%ROWTYPE;
  v_game games%ROWTYPE;
  v_player players%ROWTYPE;
  v_remaining INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_entry FROM player_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;

  SELECT * INTO v_game FROM games WHERE id = v_entry.game_id FOR UPDATE;
  IF v_game.status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'Can only delete players from draft or active games';
  END IF;

  SELECT * INTO v_player FROM players WHERE id = v_entry.player_id;

  PERFORM log_audit('entry_deleted', 'player_entries', p_entry_id, NULL,
    jsonb_build_object(
      'player_id', v_entry.player_id,
      'player_name', v_player.name,
      'game_id', v_entry.game_id
    ));

  DELETE FROM winners WHERE entry_id = p_entry_id;

  DELETE FROM player_entries WHERE id = p_entry_id;

  SELECT COUNT(*) INTO v_remaining
  FROM player_entries
  WHERE player_id = v_entry.player_id;

  IF v_remaining = 0 THEN
    DELETE FROM players WHERE id = v_entry.player_id;
  END IF;

  PERFORM recalc_game_prize_pool(v_entry.game_id);
END;
$$;

ALTER FUNCTION rpc_update_player_entry(UUID, TEXT, SMALLINT[], TEXT) OWNER TO postgres;
ALTER FUNCTION rpc_delete_player_entry(UUID) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION rpc_update_player_entry(UUID, TEXT, SMALLINT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_player_entry(UUID) TO authenticated;
