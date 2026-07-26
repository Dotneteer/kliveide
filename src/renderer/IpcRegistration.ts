export type IpcRendererLike = {
  on: (channel: string, listener: (...args: any[]) => void) => void;
  off?: (channel: string, listener: (...args: any[]) => void) => void;
  removeListener?: (channel: string, listener: (...args: any[]) => void) => void;
  send: (channel: string, message: unknown) => void;
};

export function getElectronIpcRenderer(): IpcRendererLike | undefined {
  return (window as any).electron?.ipcRenderer;
}

export function registerIpcHandler(
  ipcRenderer: IpcRendererLike | undefined,
  channel: string,
  listener: (...args: any[]) => void
): () => void {
  if (!ipcRenderer) {
    return () => {};
  }

  ipcRenderer.on(channel, listener);
  return () => {
    if (ipcRenderer.off) {
      ipcRenderer.off(channel, listener);
    } else {
      ipcRenderer.removeListener?.(channel, listener);
    }
  };
}
