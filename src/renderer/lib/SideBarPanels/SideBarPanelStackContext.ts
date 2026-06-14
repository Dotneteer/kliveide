import { createContext, type RefObject } from "react";

export type SideBarPanelRegistration = {
  panelId: string;
  expanded: boolean;
  initialSize: number;
  elementRef: RefObject<HTMLDivElement | null>;
};

export type SideBarPanelStackContextValue = {
  draggingPanelId: string | null;
  minPanelSize: number;
  getPanelSize: (panelId: string, initialSize: number) => number;
  isPanelSizeable: (panelId: string) => boolean;
  registerPanel: (registration: SideBarPanelRegistration) => void;
  startResize: (panelId: string, clientY: number) => void;
  unregisterPanel: (panelId: string) => void;
};

export const SideBarPanelStackContext = createContext<SideBarPanelStackContextValue | null>(null);
