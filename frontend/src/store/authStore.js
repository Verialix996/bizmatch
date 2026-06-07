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
    const hasSeenOnboarding = !!(user.has_seen_onboarding);
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
      const user = userStr ? JSON.parse(userStr) : null;
      const hasSeenOnboarding = !!(user?.has_seen_onboarding);
      if (token && user) set({ token, user, hasSeenOnboarding, isRestoring: false });
      else set({ hasSeenOnboarding, isRestoring: false });
    } catch { set({ isRestoring: false }); }
  },

  setHasSeenOnboarding: () => {
    set(state => {
      const updated = state.user ? { ...state.user, has_seen_onboarding: true } : state.user;
      if (updated) SecureStore.setItemAsync('auth_user', JSON.stringify(updated)).catch(() => {});
      return { user: updated, hasSeenOnboarding: true };
    });
  },

  setNewMatchCount: (count) => set({ newMatchCount: count }),

  markMatchRead: (matchId) => set(state => ({
    readTimestamps: { ...state.readTimestamps, [matchId]: Date.now() },
  })),

  logout: () => {
    set({ token: null, user: null, newMatchCount: 0, readTimestamps: {}, hasSeenOnboarding: false });
    SecureStore.deleteItemAsync('auth_token').catch(() => {});
    SecureStore.deleteItemAsync('auth_user').catch(() => {});
    SecureStore.deleteItemAsync('has_seen_onboarding').catch(() => {});
  },
}));

export default useAuthStore;
