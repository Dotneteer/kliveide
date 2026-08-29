import {
  RequestMessage,
  NotReadyResponse,
  ResponseMessage,
  errorResponse
} from "@messaging/messages-core";
import {
  getCachedAppServices,
  getCachedMessenger,
  getCachedStore
} from "@renderer/CachedServices";
import {
  getElectronIpcRenderer,
  IpcRendererLike,
  registerIpcHandler
} from "@renderer/IpcRegistration";
import { processMainToEmuMessages } from "./MainToEmuProcessor";

let unregisterMainToEmuIpc: (() => void) | undefined;

export function registerMainToEmuIpc(
  ipcRenderer: IpcRendererLike | undefined = getElectronIpcRenderer()
): () => void {
  if (unregisterMainToEmuIpc) {
    return unregisterMainToEmuIpc;
  }

  const unregister = registerIpcHandler(
    ipcRenderer,
    "MainToEmu",
    async (_ev, msg: RequestMessage) => {
      if (!getCachedAppServices()) {
        ipcRenderer?.send("MainToEmuResponse", {
          type: "NotReady"
        } as NotReadyResponse);
        return;
      }

      let response: ResponseMessage;
      try {
        response = await processMainToEmuMessages(
          msg,
          getCachedStore(),
          getCachedMessenger(),
          getCachedAppServices()
        );
      } catch (err) {
        response = errorResponse(String(err));
      }

      response.correlationId = msg.correlationId;
      response.sourceId = "emu";
      ipcRenderer?.send("MainToEmuResponse", response);
    }
  );

  unregisterMainToEmuIpc = () => {
    unregister();
    unregisterMainToEmuIpc = undefined;
  };
  return unregisterMainToEmuIpc;
}
