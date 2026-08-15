import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { fetchProfile } from '../services/auth.service';

const useAuthStore = create((set, get) => ({
  token: null,
  user: null,
  hasSeenOnboarding: false,
  isRestoring: true,
  // True while the user is on a password-recovery session (landed here via the
  // "reset password" email link). Kept separate from token/user so the app
  // routes to ResetPasswordScreen instead of treating this as a normal login.
  isPasswordRecovery: false,

  // Called after any successful sign-in/sign-up/OAuth/OTP-verify event, or
  // during restore, with the Supabase session already established.
  setAuth: async (session) => {
    const result = await fetchProfile(session);
    if (!result) return;
    set({
      token: session.access_token,
      user: result.profile,
      hasSeenOnboarding: !!result.profile.has_seen_onboarding,
    });
  },

  // No-op kept for App.js's mount-time call — the actual listener is
  // registered at module load below, not here, so it can't race the
  // PASSWORD_RECOVERY event Supabase fires while parsing the reset-link URL
  // (which can resolve before any component has mounted).
  restoreAuth: () => {},

  // Called once the recovery session's password has actually been changed:
  // drops the recovery session so the user has to sign in fresh with it.
  // scope: 'local' avoids the server-side global-revocation round-trip,
  // which can 403 for a just-rotated recovery session (the password change
  // itself rotates its tokens) — when that happened, the unguarded global
  // signOut() used to throw here, aborting before local state was ever
  // cleared and leaving the user silently still authenticated with the
  // recovery session. Local state is now cleared unconditionally, even if
  // signOut itself fails for any other reason.
  clearPasswordRecovery: async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Best-effort — local state below is cleared regardless.
    }
    set({ token: null, user: null, hasSeenOnboarding: false, isPasswordRecovery: false });
  },

  updateUser: (partial) => {
    set(state => ({ user: state.user ? { ...state.user, ...partial } : state.user }));
  },

  setHasSeenOnboarding: () => {
    set(state => ({
      user: state.user ? { ...state.user, has_seen_onboarding: true } : state.user,
      hasSeenOnboarding: true,
    }));
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ token: null, user: null, hasSeenOnboarding: false, isPasswordRecovery: false });
  },
}));

// Tracks the recovery session's own access token, outside the store (never
// cleared — see the check below for why). A used recovery link is one-time
// per token, so permanently blacklisting it for this tab's lifetime is safe.
let recoverySessionToken = null;

// Registered at module load (not inside a React effect) so it can't miss the
// PASSWORD_RECOVERY event: Supabase parses the reset-link URL and fires it as
// soon as the client initializes, which can happen before any component has
// had a chance to mount and subscribe.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoverySessionToken = session?.access_token ?? null;
    useAuthStore.setState({ isPasswordRecovery: true, token: null, user: null, isRestoring: false });
    return;
  }
  // Blocks any event carrying this exact recovery session, regardless of
  // whether isPasswordRecovery has already been cleared — closes a race
  // where ResetPasswordScreen's resetPassword() call (supabase.auth.
  // updateUser({password})) fires its own USER_UPDATED event for this same
  // session, and gotrue-js doesn't guarantee it's delivered before the
  // clearPasswordRecovery() call right after it finishes resetting the flag.
  // Without this, that event falls through and silently logs the user back
  // in with the very session that was supposed to be discarded.
  if (recoverySessionToken && session?.access_token === recoverySessionToken) {
    useAuthStore.setState({ isRestoring: false });
    return;
  }
  // Once we're in a recovery flow, the same recovery session can still fire
  // other session-bearing events (e.g. INITIAL_SESSION/TOKEN_REFRESHED) while
  // the client finishes bootstrapping — those must not silently log the user
  // in and skip past ResetPasswordScreen before they've actually set a new
  // password. Stay pinned here until clearPasswordRecovery() runs.
  if (useAuthStore.getState().isPasswordRecovery) {
    useAuthStore.setState({ isRestoring: false });
    return;
  }
  if (session) {
    useAuthStore.getState().setAuth(session).finally(() => useAuthStore.setState({ isRestoring: false }));
  } else {
    useAuthStore.setState({ token: null, user: null, hasSeenOnboarding: false, isRestoring: false });
  }
});

export default useAuthStore;
