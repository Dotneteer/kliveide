export type KliveSettings = {
  theme?: string;
  showKeyboard?: boolean;
  showIdeToolbar?: boolean;
  showIdeStatusBar?: boolean;
  showEmuToolbar?: boolean;
  showEmuStatusBar?: boolean;
  primaryBarRight?: boolean;
  toolPanelsTop?: boolean;
  maximizeTools?: boolean;
  machineSpecific?: Record<string, any>;
  clockMultiplier?: number;
  soundLevel?: number;
  media?: Record<string, any>;
  windowStates?: {
    ideZoomFactor?: number;
    emuZoomFactor?: number;
    ideWindow?: WindowState;
    emuWindow?: WindowState;
    showIdeOnStartup?: boolean;
  };
  folders?: {
    z88CardsFolder?: string;
    lastProjectFolder?: string;
    tapeFileFolder?: string;
    diskFileFolder?: string;
    newProjectFolder?: string;
    exportCodeFolder?: string;
    newDiskFolder?: string;
    sdCardFileFolder?: string;
  };
  excludedProjectItems?: string[];
  userSettings?: Record<string, any>;
  recentProjects?: string[];
  showShadowScreen?: boolean;
  showInstantScreen?: boolean;
  ideSettings?: Record<string, any>;
  project?: {
    folderPath?: string;
  };
  emuStayOnTop?: boolean;
  golbalSettings?: Record<string, any>; // Note: keeping typo for backward compatibility
  globalSettings?: {
    ideViewOptions?: {
      showSidebar?: boolean;
      maximizeTools?: boolean;
      sideBarWidth?: string;
      toolPanelHeight?: string;
      showTools?: boolean;
      activeOutputPane?: string;
      activeTool?: string;
    };
    emuOptions?: {
      stayOnTop?: boolean;
    };
  };
  startScreenDisplayed?: boolean;
  machineId?: string;
};

export type WindowState = {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  displayBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isFullScreen?: boolean;
  isMaximized?: boolean;
};
