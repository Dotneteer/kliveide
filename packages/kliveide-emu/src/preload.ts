import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

import { IpcRendereApi } from "./exposed-apis";

contextBridge.exposeInMainWorld("ipcRenderer", <IpcRendereApi>{
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ) => ipcRenderer.on(channel, listener),
});
