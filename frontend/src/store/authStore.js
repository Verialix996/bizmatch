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
  clearPasswordRecovery: async () => {
    await supabase.auth.signOut();
    set({ token: null, user: null, hasSeenOnboarding: false, isPasswordRecovery: false });
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

// Registered at module load (not inside a React effect) so it can't miss the
// PASSWORD_RECOVERY event: Supabase parses the reset-link URL and fires it as
// soon as the client initializes, which can happen before any component has
// had a chance to mount and subscribe.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    useAuthStore.setState({ isPasswordRecovery: true, token: null, user: null, isRestoring: false });
    return;
  }
  if (session) {
    useAuthStore.getState().setAuth(session).finally(() => useAuthStore.setState({ isRestoring: false }));
  } else {
    useAuthStore.setState({ token: null, user: null, hasSeenOnboarding: false, isRestoring: false });
  }
});

export default useAuthStore;
