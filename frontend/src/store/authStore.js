import { create } from 'zustand';
import * as storage from '../services/storage';

const useAuthStore = create((set) => ({
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
      await storage.setItem('auth_token', token);
      await storage.setItem('auth_user', JSON.stringify(user));
    } catch { /* silent */ }
  },

  updateUser: (updates) => {
    set(state => {
      const updated = state.user ? { ...state.user, ...updates } : state.user;
      storage.setItem('auth_user', JSON.stringify(updated)).catch(() => {});
      return { user: updated };
    });
  },

  restoreAuth: async () => {
    try {
      const token = await storage.getItem('auth_token');
      const userStr = await storage.getItem('auth_user');
      const user = userStr ? JSON.parse(userStr) : null;
      const hasSeenOnboarding = !!(user?.has_seen_onboarding);
      if (token && user) set({ token, user, hasSeenOnboarding, isRestoring: false });
      else set({ hasSeenOnboarding, isRestoring: false });
    } catch { set({ isRestoring: false }); }
  },

  setHasSeenOnboarding: () => {
    set(state => {
      const updated = state.user ? { ...state.user, has_seen_onboarding: true } : state.user;
      if (updated) storage.setItem('auth_user', JSON.stringify(updated)).catch(() => {});
      return { user: updated, hasSeenOnboarding: true };
    });
  },

  setNewMatchCount: (count) => set({ newMatchCount: count }),

  markMatchRead: (matchId) => set(state => ({
    readTimestamps: { ...state.readTimestamps, [matchId]: Date.now() },
  })),

  logout: () => {
    set({ token: null, user: null, newMatchCount: 0, readTimestamps: {}, hasSeenOnboarding: false });
    storage.deleteItem('auth_token').catch(() => {});
    storage.deleteItem('auth_user').catch(() => {});
    storage.deleteItem('has_seen_onboarding').catch(() => {});
  },
}));

export default useAuthStore;
