/**
 * UI-only state (panels, dialogs, sheets, toasts). Not shareable, not part of the atlas contract.
 */
import { create } from 'zustand';

export type SidebarTab = 'layers' | 'tree';
export type PhoneSheet = 'layers' | 'tree' | 'tools' | 'info' | null;

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

interface UiState {
  /** null = default for the breakpoint (open on desktop, closed on tablet). */
  sidebarOpen: boolean | null;
  sidebarTab: SidebarTab;
  infoCollapsed: boolean;
  helpOpen: boolean;
  aboutOpen: boolean;
  sheet: PhoneSheet;
  toast: Toast | null;
  setSidebarOpen(open: boolean): void;
  setSidebarTab(tab: SidebarTab): void;
  setInfoCollapsed(c: boolean): void;
  setHelpOpen(open: boolean): void;
  setAboutOpen(open: boolean): void;
  setSheet(sheet: PhoneSheet): void;
  showToast(message: string, tone?: Toast['tone']): void;
  dismissToast(): void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: null,
  sidebarTab: 'layers',
  infoCollapsed: false,
  helpOpen: false,
  aboutOpen: false,
  sheet: null,
  toast: null,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setInfoCollapsed: (infoCollapsed) => set({ infoCollapsed }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setSheet: (sheet) => set({ sheet }),
  showToast: (message, tone = 'info') => set({ toast: { id: ++toastSeq, message, tone } }),
  dismissToast: () => set({ toast: null }),
}));
