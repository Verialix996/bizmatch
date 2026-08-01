const _backend =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://zooming-surprise-production.up.railway.app';

export const API_BASE_URL     = `${_backend}/api`;
export const BACKEND_BASE_URL = _backend;

// Supabase (Auth + Postgres) — publishable key only, safe for client bundles.
export const SUPABASE_URL             = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
