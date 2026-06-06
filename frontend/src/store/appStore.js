import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const useAppStore = create((set) => ({
  investorMode: false,
  selectedProject: null,
  showProjectPicker: false,
  darkMode: false,
  isInvestorTheme: false,
  notificationTick: 0,
  bumpNotificationTick: () => set(s => ({ notificationTick: s.notificationTick + 1 })),
  pendingBanner: null,
  showBanner: (banner) => set({ pendingBanner: banner }),
  dismissBanner: () => set({ pendingBanner: null }),

  enterInvestorMode: (project) => set({ investorMode: true, selectedProject: project, showProjectPicker: false }),
  exitInvestorMode: () => set({ investorMode: false, selectedProject: null }),
  setSelectedProject: (project) => set({ selectedProject: project, showProjectPicker: false }),
  openProjectPicker: () => set({ showProjectPicker: true }),
  closeProjectPicker: () => set({ showProjectPicker: false }),

  setInvestorTheme: (val) => set(val
    ? { isInvestorTheme: true, investorMode: false, selectedProject: null }
    : { isInvestorTheme: false }),

  setDarkMode: (val) => {
    set({ darkMode: val });
    SecureStore.setItemAsync('dark_mode', val ? '1' : '0').catch(() => {});
  },
  initDarkMode: async () => {
    try {
      const saved = await SecureStore.getItemAsync('dark_mode');
      if (saved === '1') set({ darkMode: true });
    } catch { /* silent */ }
  },
}));

export default useAppStore;
