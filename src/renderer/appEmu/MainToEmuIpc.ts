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
      // --- A forwarded state action only needs the store, which exists from module load onwards.
      // --- Requiring the app services here too would reject the main process's initial state
      // --- broadcast, which is sent very early and would then be lost for good.
      const needsAppServices = msg?.type !== "ForwardAction";
      if (!getCachedStore() || (needsAppServices && !getCachedAppServices())) {
        // --- The correlation ID must be echoed back, otherwise the sender cannot match this
        // --- response to its pending request and would wait forever instead of learning that
        // --- this window was not ready yet.
        ipcRenderer?.send("MainToEmuResponse", {
          type: "NotReady",
          correlationId: msg.correlationId,
          sourceId: "emu"
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
