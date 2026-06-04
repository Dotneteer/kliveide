export {};

declare global {
  interface Window {
    electronShell: {
      openIde: () => Promise<void>;
      onSaveBeforeClose: (handler: () => void | Promise<void>) => () => void;
    };
  }
}
