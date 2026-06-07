import { contextBridge, ipcRenderer } from "electron";

let saveBeforeCloseHandler: () => void | Promise<void> = () => {};

ipcRenderer.on("window:save-before-close", async (_event, requestId: string) => {
  try {
    await saveBeforeCloseHandler();
  } finally {
    ipcRenderer.send(`window:save-before-close-complete:${requestId}`);
  }
});

contextBridge.exposeInMainWorld("electronShell", {
  openIde: () => ipcRenderer.invoke("ide:open"),
  onSaveBeforeClose: (handler: () => void | Promise<void>) => {
    saveBeforeCloseHandler = handler;

    return () => {
      if (saveBeforeCloseHandler === handler) {
        saveBeforeCloseHandler = () => {};
      }
    };
  }
});

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
        listener(_event, ...args);
      ipcRenderer.on(channel, wrappedListener);

      return () => ipcRenderer.removeListener(channel, wrappedListener);
    }
  }
});
