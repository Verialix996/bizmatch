// Supabase (Auth + Postgres + Storage + Edge Functions) — publishable key
// only, safe for client bundles.
export const SUPABASE_URL             = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// The backend is now a set of Supabase Edge Functions, one per route group
// (e.g. `${API_BASE_URL}/match/feed`), replacing the old Express/Railway API.
export const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;
