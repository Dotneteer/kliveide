export {};

declare global {
  interface Window {
    electronShell: {
      openIde: () => Promise<void>;
      onSaveBeforeClose: (handler: () => void | Promise<void>) => () => void;
    };
    electron: {
      ipcRenderer: {
        send: (channel: string, ...args: unknown[]) => void;
        on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
      };
    };
    kliveDemo: {
      getWindowKind: () => "emu" | "ide";
      getLatestStatus: () => string;
      getTheme: () => string | undefined;
      readMainPublicFile: () => Promise<string>;
      askIdeToShowMemory: () => Promise<string>;
      askEmuToSetMachineType: () => Promise<string>;
      toggleTheme: () => string;
    };
  }
}
