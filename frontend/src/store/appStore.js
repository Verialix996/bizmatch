import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const useAppStore = create((set) => ({
  investorMode: false,
  selectedProject: null,
  showProjectPicker: false,
  darkMode: false,

  enterInvestorMode: (project) => set({ investorMode: true, selectedProject: project, showProjectPicker: false }),
  exitInvestorMode: () => set({ investorMode: false, selectedProject: null }),
  setSelectedProject: (project) => set({ selectedProject: project, showProjectPicker: false }),
  openProjectPicker: () => set({ showProjectPicker: true }),
  closeProjectPicker: () => set({ showProjectPicker: false }),

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
