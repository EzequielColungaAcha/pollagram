-- 007_fix_table_and_rpc_grants.sql
-- Supabase-standard grants so SECURITY DEFINER RPCs can write app tables.

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

GRANT SELECT ON leaderboard_view TO anon, authenticated;

-- Ensure write RPCs run as postgres (bypasses RLS for transactional writes).
ALTER FUNCTION is_admin() OWNER TO postgres;
ALTER FUNCTION log_audit(audit_action, TEXT, UUID, JSONB, JSONB) OWNER TO postgres;
ALTER FUNCTION recalc_game_prize_pool(UUID) OWNER TO postgres;
ALTER FUNCTION update_entry_progress(UUID) OWNER TO postgres;
ALTER FUNCTION distribute_prizes(UUID) OWNER TO postgres;
ALTER FUNCTION process_draw_matches(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_enter_draw(UUID, DATE, SMALLINT[]) OWNER TO postgres;
ALTER FUNCTION rpc_invalidate_draw(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_create_player(TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION rpc_create_game(TEXT, DATE, DATE) OWNER TO postgres;
ALTER FUNCTION rpc_open_game(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_close_game(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_archive_game(UUID) OWNER TO postgres;
ALTER FUNCTION rpc_create_entry(UUID, UUID, SMALLINT[]) OWNER TO postgres;
ALTER FUNCTION rpc_edit_entry_numbers(UUID, SMALLINT[]) OWNER TO postgres;
ALTER FUNCTION rpc_update_settings(NUMERIC, NUMERIC) OWNER TO postgres;
ALTER FUNCTION handle_new_user() OWNER TO postgres;

-- Future objects in public schema (local dev convenience).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
