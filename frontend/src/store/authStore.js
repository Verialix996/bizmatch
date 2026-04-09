import { create } from 'zustand';

const useAuthStore = create((set) => ({
  token: null,
  user: null,
  newMatchCount: 0,

  setAuth: (token, user) => {
    set({ token, user });
  },

  updateUser: (updates) => {
    set(state => ({ user: state.user ? { ...state.user, ...updates } : state.user }));
  },

  setNewMatchCount: (count) => set({ newMatchCount: count }),

  logout: () => {
    set({ token: null, user: null, newMatchCount: 0 });
  },
}));

export default useAuthStore;
