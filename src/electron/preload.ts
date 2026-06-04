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
