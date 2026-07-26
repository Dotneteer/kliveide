import {
  RequestMessage,
  NotReadyResponse,
  ResponseMessage,
  errorResponse
} from "@messaging/messages-core";
import {
  getCachedAppServices,
  getCachedStore
} from "@renderer/CachedServices";
import {
  getElectronIpcRenderer,
  IpcRendererLike,
  registerIpcHandler
} from "@renderer/IpcRegistration";
import { processMainToIdeMessages } from "./MainToIdeProcessor";

let unregisterMainToIdeIpc: (() => void) | undefined;

export function registerMainToIdeIpc(
  ipcRenderer: IpcRendererLike | undefined = getElectronIpcRenderer()
): () => void {
  if (unregisterMainToIdeIpc) {
    return unregisterMainToIdeIpc;
  }

  const unregister = registerIpcHandler(
    ipcRenderer,
    "MainToIde",
    async (_ev, msg: RequestMessage) => {
      if (!getCachedAppServices()) {
        ipcRenderer?.send("MainToIdeResponse", {
          type: "NotReady"
        } as NotReadyResponse);
        return;
      }

      let response: ResponseMessage;
      try {
        response = await processMainToIdeMessages(
          msg,
          getCachedStore(),
          getCachedAppServices()
        );
      } catch (err) {
        response = errorResponse(String(err));
      }

      response.correlationId = msg.correlationId;
      response.sourceId = "ide";
      ipcRenderer?.send("MainToIdeResponse", response);
    }
  );

  unregisterMainToIdeIpc = () => {
    unregister();
    unregisterMainToIdeIpc = undefined;
  };
  return unregisterMainToIdeIpc;
}
