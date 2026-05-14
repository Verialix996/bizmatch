import { create } from 'zustand';

const useAppStore = create((set) => ({
  investorMode: false,
  selectedProject: null,
  showProjectPicker: false,

  enterInvestorMode: (project) => set({ investorMode: true, selectedProject: project, showProjectPicker: false }),
  exitInvestorMode: () => set({ investorMode: false, selectedProject: null }),
  setSelectedProject: (project) => set({ selectedProject: project, showProjectPicker: false }),
  openProjectPicker: () => set({ showProjectPicker: true }),
  closeProjectPicker: () => set({ showProjectPicker: false }),
}));

export default useAppStore;
