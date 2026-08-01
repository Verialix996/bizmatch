import { create } from 'zustand';
import * as storage from '../services/storage';

const useAppStore = create((set) => ({
  darkMode: false,
  isInvestorTheme: false,
  notificationTick: 0,
  bumpNotificationTick: () => set(s => ({ notificationTick: s.notificationTick + 1 })),
  pendingBanner: null,
  showBanner: (banner) => set({ pendingBanner: banner }),
  dismissBanner: () => set({ pendingBanner: null }),
  activeChatMatchId: null,
  setActiveChatMatchId: (id) => set({ activeChatMatchId: id }),

  setInvestorTheme: (val) => set({ isInvestorTheme: !!val }),

  setDarkMode: (val) => {
    set({ darkMode: val });
    storage.setItem('dark_mode', val ? '1' : '0').catch(() => {});
  },
  initDarkMode: async () => {
    try {
      const saved = await storage.getItem('dark_mode');
      if (saved === '1') set({ darkMode: true });
    } catch { /* silent */ }
  },
}));

export default useAppStore;
