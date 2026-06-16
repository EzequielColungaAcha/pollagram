-- 002_rls_policies.sql

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_rollovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Public read policies
CREATE POLICY public_read_games ON games FOR SELECT USING (true);
CREATE POLICY public_read_players ON players FOR SELECT USING (true);
CREATE POLICY public_read_entries ON player_entries FOR SELECT USING (true);
CREATE POLICY public_read_entry_numbers ON entry_numbers FOR SELECT USING (true);
CREATE POLICY public_read_draws ON lottery_draws FOR SELECT USING (NOT is_invalidated);
CREATE POLICY public_read_draw_numbers ON draw_numbers FOR SELECT USING (true);
CREATE POLICY public_read_matches ON matches FOR SELECT USING (true);
CREATE POLICY public_read_winners ON winners FOR SELECT USING (true);
CREATE POLICY public_read_rollovers ON prize_rollovers FOR SELECT USING (true);
CREATE POLICY public_read_settings ON app_settings FOR SELECT USING (true);

-- Admin policies
CREATE POLICY admin_all_players ON players FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_games ON games FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_entries ON player_entries FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_entry_numbers ON entry_numbers FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_draws ON lottery_draws FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_draw_numbers ON draw_numbers FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_matches ON matches FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_winners ON winners FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_rollovers ON prize_rollovers FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_all_settings ON app_settings FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_read_audit ON audit_logs FOR SELECT USING (is_admin());
CREATE POLICY admin_insert_audit ON audit_logs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY admin_read_profile ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY admin_update_profile ON profiles FOR UPDATE USING (auth.uid() = id);

-- RPC functions run as SECURITY DEFINER and bypass RLS for transactional writes
