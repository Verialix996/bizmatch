import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import api from './api';

WebBrowser.maybeCompleteAuthSession();

// Supabase has no pre-insert hook to run custom validation before an account
// is created, so the moderation check on the display name happens here first.
async function precheckName(name) {
  await api.post('/auth/precheck-name', { name });
}

export async function register({ name, email, password }) {
  await precheckName(name);
  // Self-serve signup always creates a 'founder' — there's no role picker in
  // the pivot's Register screen (admins are seeded/promoted directly, not
  // created through this flow).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'founder' } },
  });
  if (error) throw error;
  // Supabase returns 200 with an empty identities array for an already-registered
  // email instead of an error, to avoid leaking which emails are registered.
  if (data?.user && data.user.identities?.length === 0) {
    throw new Error('An account with this email already exists. Try signing in instead.');
  }
}

export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function verifySignupOtp(email, code) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
  if (error) throw error;
  return data.session;
}

export async function resendOtp(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function forgotPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: Platform.OS === 'web' ? `${window.location.origin}/reset-password` : 'bizmatch://reset-password',
  });
  if (error) throw error;
}

// Assumes a recovery session is already active (established by the reset-password
// link's redirect, picked up automatically by the Supabase client on web).
export async function resetPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    // Full-page redirect; the client picks the session up on return
    // (detectSessionInUrl) with no popup/polling infrastructure needed.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return null;
  }

  const redirectTo = 'bizmatch://auth-callback';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return null;

  const hash = result.url.split('#')[1] || result.url.split('?')[1] || '';
  const params = Object.fromEntries(new URLSearchParams(hash));
  if (!params.access_token || !params.refresh_token) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (sessionError) throw sessionError;
  return sessionData.session;
}

// After any successful auth event, fetch our own app-side profile row
// (role, premium, has_seen_onboarding, etc. — not part of Supabase's auth.users).
// Passes the token explicitly rather than relying on the axios interceptor's
// authStore read — at this point the store's token isn't set yet (setAuth
// only sets it after this call resolves), so the interceptor would send no
// Authorization header at all.
export async function fetchProfile(session) {
  if (!session) return null;
  const { data } = await api.get('/users/me', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  return { session, profile: data };
}

// Backend expects a base64 data URI in a JSON body, not multipart form data.
export const uploadPhoto = (dataUri) => api.post('/users/me/photo', { photo: dataUri });
