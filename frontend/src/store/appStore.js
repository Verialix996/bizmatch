import { create } from 'zustand';
import * as storage from '../services/storage';

const useAppStore = create((set) => ({
  darkMode: false,
  // Which cohort/program the top bar's switcher currently has selected —
  // threaded into program-scoped list/dashboard queries. null = "all"/no
  // filter (falls back to showing everything, same as before this existed).
  // In-memory only (resets on reload) — not worth persisting for a value
  // that only matters once more than one program actually exists.
  activeProgramId: null,
  setActiveProgramId: (id) => set({ activeProgramId: id }),
  notificationTick: 0,
  bumpNotificationTick: () => set(s => ({ notificationTick: s.notificationTick + 1 })),
  pendingBanner: null,
  showBanner: (banner) => set({ pendingBanner: banner }),
  dismissBanner: () => set({ pendingBanner: null }),
  pendingAlert: null,
  showAlertModal: (alert) => set({ pendingAlert: alert }),
  dismissAlertModal: () => set({ pendingAlert: null }),

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
