-- 021_active_game_draw_window.sql
-- Active games must ignore stale closed_at when applying draws.
-- Also clear closed_at when activating a draft game.

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
        -- Explicit close date (reprocess of historically closed games)
        (p_close_date IS NOT NULL AND ld.draw_date <= p_close_date)
        -- Active games: no upper bound (ignore stale closed_at)
        OR (p_close_date IS NULL AND g.status = 'active')
        -- Closed/archived (or unknown) without explicit override: use closed_at
        OR (
          p_close_date IS NULL
          AND g.status <> 'active'
          AND (
            g.closed_at IS NULL
            OR ld.draw_date <= DATE(g.closed_at)
          )
        )
      )
  );
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

  UPDATE games
  SET status = 'active', closed_at = NULL, final_awarded = NULL
  WHERE id = p_game_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game must be draft to open';
  END IF;

  v_retroactive_matches := process_game_retroactive_matches(p_game_id);

  PERFORM log_audit('game_opened', 'games', p_game_id, NULL,
    jsonb_build_object('status', 'active', 'retroactive_matches', v_retroactive_matches));
END;
$$;

-- Repair: clear stale closed_at on active games, then reprocess so missed draws apply.
DO $$
DECLARE
  v_game RECORD;
BEGIN
  UPDATE games
  SET closed_at = NULL
  WHERE status = 'active'
    AND closed_at IS NOT NULL;

  FOR v_game IN
    SELECT g.id
    FROM games g
    WHERE g.status = 'active'
      AND EXISTS (SELECT 1 FROM player_entries pe WHERE pe.game_id = g.id)
  LOOP
    PERFORM reprocess_game_matches(v_game.id);
  END LOOP;
END $$;

ALTER FUNCTION draw_applies_to_game(UUID, UUID, DATE) OWNER TO postgres;
ALTER FUNCTION rpc_open_game(UUID) OWNER TO postgres;
