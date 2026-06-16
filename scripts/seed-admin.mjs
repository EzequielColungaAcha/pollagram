/**
 * Seed admin user in Supabase Auth + profiles table.
 *
 * Usage:
 *   cp .env.local.example .env.local
 *   # Fill SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
 *   pnpm seed:admin:local
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureProfile(userId) {
  const { error } = await supabase.from("profiles").upsert(
    { id: userId, email, role: "admin" },
    { onConflict: "id" },
  );
  if (error) {
    console.error("Failed to upsert profile:", error.message);
    process.exit(1);
  }
}

const { data: existingUsers, error: listError } =
  await supabase.auth.admin.listUsers();
if (listError) {
  console.error(listError);
  process.exit(1);
}

const existing = existingUsers.users.find((u) => u.email === email);

if (existing) {
  await ensureProfile(existing.id);
  console.log("Admin user already exists:", email);
  console.log("Profile ensured.");
  process.exit(0);
}

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error(error);
  process.exit(1);
}

if (data.user) {
  await ensureProfile(data.user.id);
}

console.log("Admin user created:", data.user?.email);
console.log("Profile row created.");
