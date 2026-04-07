import { create } from 'zustand';

const useAuthStore = create((set) => ({
  token: null,
  user: null,

  setAuth: (token, user) => {
    set({ token, user });
  },

  updateUser: (updates) => {
    set(state => ({ user: state.user ? { ...state.user, ...updates } : state.user }));
  },

  logout: () => {
    set({ token: null, user: null });
  },
}));

export default useAuthStore;
