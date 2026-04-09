import { create } from 'zustand';

const useAuthStore = create((set) => ({
  token: null,
  user: null,
  newMatchCount: 0,
  readTimestamps: {}, // matchId → timestamp when last opened

  setAuth: (token, user) => {
    set({ token, user });
  },

  updateUser: (updates) => {
    set(state => ({ user: state.user ? { ...state.user, ...updates } : state.user }));
  },

  setNewMatchCount: (count) => set({ newMatchCount: count }),

  markMatchRead: (matchId) => set(state => ({
    readTimestamps: { ...state.readTimestamps, [matchId]: Date.now() },
  })),

  logout: () => {
    set({ token: null, user: null, newMatchCount: 0, readTimestamps: {} });
  },
}));

export default useAuthStore;
