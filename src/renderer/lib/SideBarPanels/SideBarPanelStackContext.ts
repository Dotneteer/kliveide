import { createContext, type RefObject } from "react";

export type SideBarPanelRegistration = {
  panelId: string;
  expanded: boolean;
  initialSize: number;
  order: number;
  elementRef: RefObject<HTMLDivElement | null>;
};

export type SideBarPanelStackContextValue = {
  draggingPanelId: string | null;
  isResizing: boolean;
  minPanelSize: number;
  getPanelSize: (panelId: string, initialSize: number) => number;
  isPanelSizeable: (panelId: string) => boolean;
  clearPanelDropPreview: () => void;
  movePanelToIndex: (panelId: string, targetPanelId: string, afterTarget?: boolean) => void;
  previewPanelDrop: (panelId: string, targetPanelId: string, afterTarget?: boolean) => void;
  registerPanel: (registration: SideBarPanelRegistration) => void;
  startResize: (panelId: string, clientY: number) => void;
  unregisterPanel: (panelId: string) => void;
};

export const SideBarPanelStackContext = createContext<SideBarPanelStackContextValue | null>(null);
