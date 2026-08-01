import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { fetchProfile } from '../services/auth.service';

const useAuthStore = create((set, get) => ({
  token: null,
  user: null,
  newMatchCount: 0,
  readTimestamps: {},
  hasSeenOnboarding: false,
  isRestoring: true,

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

  updateUser: (updates) => {
    set(state => ({ user: state.user ? { ...state.user, ...updates } : state.user }));
  },

  // Establishes the Supabase session listener once at boot. Supabase's client
  // (with an AsyncStorage adapter) persists/refreshes the session itself —
  // no manual token storage needed here anymore.
  restoreAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await get().setAuth(session);
    set({ isRestoring: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        get().setAuth(session);
      } else {
        set({ token: null, user: null, newMatchCount: 0, readTimestamps: {}, hasSeenOnboarding: false });
      }
    });
  },

  setHasSeenOnboarding: () => {
    set(state => ({
      user: state.user ? { ...state.user, has_seen_onboarding: true } : state.user,
      hasSeenOnboarding: true,
    }));
  },

  setNewMatchCount: (count) => set({ newMatchCount: count }),

  markMatchRead: (matchId) => set(state => ({
    readTimestamps: { ...state.readTimestamps, [matchId]: Date.now() },
  })),

  logout: async () => {
    await supabase.auth.signOut();
    set({ token: null, user: null, newMatchCount: 0, readTimestamps: {}, hasSeenOnboarding: false });
  },
}));

export default useAuthStore;
