-- 019_leaderboard_natural_nickname_sort.sql
-- Break matched-count ties by nickname (fallback to name) with natural numeric order.

CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  pe.id AS entry_id,
  pe.game_id,
  pe.matched_count,
  pe.remaining_count,
  pe.completion_pct,
  pe.is_winner,
  pe.won_at,
  p.id AS player_id,
  p.name AS player_name,
  p.nickname AS player_nickname,
  ROW_NUMBER() OVER (
    PARTITION BY pe.game_id
    ORDER BY
      pe.matched_count DESC,
      pe.remaining_count ASC,
      pe.won_at ASC NULLS LAST,
      CASE
        WHEN COALESCE(NULLIF(TRIM(p.nickname), ''), p.name) ~ '^\d+$' THEN 0
        ELSE 1
      END,
      CASE
        WHEN COALESCE(NULLIF(TRIM(p.nickname), ''), p.name) ~ '^\d+$'
        THEN (COALESCE(NULLIF(TRIM(p.nickname), ''), p.name))::numeric
      END ASC NULLS LAST,
      COALESCE(NULLIF(TRIM(p.nickname), ''), p.name) ASC
  ) AS rank
FROM player_entries pe
JOIN players p ON p.id = pe.player_id;

GRANT SELECT ON leaderboard_view TO anon, authenticated;
