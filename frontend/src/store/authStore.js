import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const useAuthStore = create((set, get) => ({
  token: null,
  user: null,
  newMatchCount: 0,
  readTimestamps: {},
  hasSeenOnboarding: false,
  isRestoring: true,

  setAuth: async (token, user) => {
    // If user already has a profile they've been through onboarding — don't show it again
    let hasSeenOnboarding = !!(user.has_profile);
    if (!hasSeenOnboarding) {
      try {
        hasSeenOnboarding = (await SecureStore.getItemAsync('has_seen_onboarding')) === 'true';
      } catch { /* SecureStore unavailable on web */ }
    }
    set({ token, user, hasSeenOnboarding });
    try {
      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    } catch { /* silent */ }
  },

  updateUser: (updates) => {
    set(state => {
      const updated = state.user ? { ...state.user, ...updates } : state.user;
      SecureStore.setItemAsync('auth_user', JSON.stringify(updated)).catch(() => {});
      return { user: updated };
    });
  },

  restoreAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const userStr = await SecureStore.getItemAsync('auth_user');
      const seenStr = await SecureStore.getItemAsync('has_seen_onboarding');
      const user = userStr ? JSON.parse(userStr) : null;
      // A profile is definitive proof they've been through onboarding; fall back to stored flag
      const hasSeenOnboarding = !!(user?.has_profile) || seenStr === 'true';
      if (token && user) set({ token, user, hasSeenOnboarding, isRestoring: false });
      else set({ hasSeenOnboarding, isRestoring: false });
    } catch { set({ isRestoring: false }); }
  },

  setHasSeenOnboarding: () => {
    set({ hasSeenOnboarding: true });
    SecureStore.setItemAsync('has_seen_onboarding', 'true').catch(() => {});
  },

  setNewMatchCount: (count) => set({ newMatchCount: count }),

  markMatchRead: (matchId) => set(state => ({
    readTimestamps: { ...state.readTimestamps, [matchId]: Date.now() },
  })),

  logout: () => {
    set({ token: null, user: null, newMatchCount: 0, readTimestamps: {} });
    SecureStore.deleteItemAsync('auth_token').catch(() => {});
    SecureStore.deleteItemAsync('auth_user').catch(() => {});
  },
}));

export default useAuthStore;
