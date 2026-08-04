import { query } from "../_shared/db.ts";
import { supabase } from "../_shared/supabase.ts";

// Credentials, OTP, password reset, and OAuth linking are all owned by
// Supabase Auth (auth.users / auth.identities) — this model only touches
// the app-side public.users row and its 1:1 satellites.
export const UserModel = {
  async findById(id: string) {
    const rows = await query("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL", [id]);
    return rows[0] || null;
  },

  async updateName(id: string, name: string) {
    await query("UPDATE users SET name = $1, updated_at = now() WHERE id = $2", [name, id]);
  },

  // auth.users row deletion cascades to public.users (and its 1:1 satellites)
  // via ON DELETE CASCADE — no separate app-side delete needed.
  async hardDelete(id: string) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
  },

  async setVerificationStatus(id: string, status: string) {
    await query("UPDATE users SET verification_status = $1 WHERE id = $2", [status, id]);
  },

  async setRole(id: string, role: string) {
    await query("UPDATE users SET role = $1, updated_at = now() WHERE id = $2", [role, id]);
    if (role === "investor") {
      await query("INSERT INTO investor_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [id]);
    }
  },

  async updatePhoto(id: string, photoUrl: string) {
    await query("UPDATE users SET photo_url = $1, updated_at = now() WHERE id = $2", [photoUrl, id]);
  },

  async setHasSeenOnboarding(id: string) {
    await query("UPDATE user_activity SET has_seen_onboarding = true WHERE user_id = $1", [id]);
  },
};
