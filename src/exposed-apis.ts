import { IpcRendererEvent } from "electron";

/**
 * The exposed API of ipcRenderer
 */
export interface IpcRendereApi {
  send(channel: string, ...args: any[]): void;
  on(
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ): this;
}
