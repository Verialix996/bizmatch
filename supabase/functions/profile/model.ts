import { query } from "../_shared/db.ts";

// Profile fields live directly on public.users (merged from the old
// user_profiles table). role_type is gone — users.role is the single source of truth.
const PROFILE_FIELDS = ["bio", "skills", "hobbies", "portfolio_url", "linkedin_url", "experience", "cv_url"];
const INVESTOR_FIELDS = ["investment_domain", "preferred_stage", "max_investment"];

export const ProfileModel = {
  async findByUserId(userId: string) {
    const rows = await query(
      `SELECT u.id AS user_id, u.bio, u.skills, u.hobbies, u.role AS role_type,
              u.portfolio_url, u.linkedin_url, u.experience, u.cv_url, u.photo_url,
              ip.investment_domain, ip.preferred_stage, ip.max_investment
       FROM users u
       LEFT JOIN investor_profiles ip ON ip.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    return rows[0] || null;
  },

  async create(userId: string, data: Record<string, unknown>) {
    return ProfileModel.upsert(userId, data);
  },

  async upsert(userId: string, data: Record<string, unknown>) {
    const nullIfEmpty = (v: unknown) => (v === "" || v === undefined ? null : v);
    const profileFields: string[] = [];
    const profileValues: unknown[] = [];
    for (const key of PROFILE_FIELDS) {
      if (data[key] !== undefined) {
        profileFields.push(key);
        let val = data[key];
        if (["skills", "hobbies"].includes(key)) val = JSON.stringify(Array.isArray(val) ? val : []);
        profileValues.push(val);
      }
    }
    if (profileFields.length) {
      const setClauses = profileFields.map((f, i) => `${f} = $${i + 2}`).join(", ");
      await query(`UPDATE users SET ${setClauses}, updated_at = now() WHERE id = $1`, [userId, ...profileValues]);
    }

    if (data.role_type === "investor") {
      const investorFields: string[] = [];
      const investorValues: unknown[] = [];
      for (const key of INVESTOR_FIELDS) {
        if (data[key] !== undefined) {
          investorFields.push(key);
          investorValues.push(key === "preferred_stage" ? nullIfEmpty(data[key]) : data[key]);
        }
      }
      const cols = ["user_id", ...investorFields];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const updates = investorFields.map((f) => `${f} = EXCLUDED.${f}`).join(", ");
      if (investorFields.length) {
        await query(
          `INSERT INTO investor_profiles (${cols.join(", ")})
           VALUES (${placeholders})
           ON CONFLICT (user_id) DO UPDATE SET ${updates}`,
          [userId, ...investorValues],
        );
      } else {
        await query("INSERT INTO investor_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [userId]);
      }
    }
    return { userId };
  },

  async update(userId: string, data: Record<string, unknown>) {
    return ProfileModel.upsert(userId, data);
  },
};
