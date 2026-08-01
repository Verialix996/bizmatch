const { query } = require('../config/db');
const supabase = require('../config/supabase');

// Credentials, OTP, password reset, and OAuth linking are all owned by
// Supabase Auth now (auth.users / auth.identities) — this model only touches
// the app-side public.users row (merged with the old user_profiles table)
// and its 1:1 satellites (investor_profiles, user_activity).
const UserModel = {
  async findById(id) {
    const rows = await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  },

  async updateName(id, name) {
    await query('UPDATE users SET name = $1, updated_at = now() WHERE id = $2', [name, id]);
  },

  // Deleting the auth.users row cascades to public.users (and its 1:1
  // satellites) via the ON DELETE CASCADE foreign key — no separate app-side
  // delete needed.
  async hardDelete(id) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
  },

  async setVerificationStatus(id, status) {
    await query('UPDATE users SET verification_status = $1 WHERE id = $2', [status, id]);
  },

  async setRole(id, role) {
    await query('UPDATE users SET role = $1, updated_at = now() WHERE id = $2', [role, id]);
    if (role === 'investor') {
      await query('INSERT INTO investor_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [id]);
    }
  },

  async updatePhoto(id, photoUrl) {
    await query('UPDATE users SET photo_url = $1, updated_at = now() WHERE id = $2', [photoUrl, id]);
  },

  async setHasSeenOnboarding(id) {
    await query('UPDATE user_activity SET has_seen_onboarding = true WHERE user_id = $1', [id]);
  },
};

module.exports = UserModel;
