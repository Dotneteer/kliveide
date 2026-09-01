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
      // --- A forwarded state action only needs the store, which exists from module load onwards.
      // --- Requiring the app services here too would reject the main process's initial state
      // --- broadcast (theme, machine type, model, key mappings, global settings, ...), which is
      // --- sent as soon as the emulator window is ready and would then be lost for good.
      const needsAppServices = msg?.type !== "ForwardAction";
      if (!getCachedStore() || (needsAppServices && !getCachedAppServices())) {
        // --- The correlation ID must be echoed back, otherwise the sender cannot match this
        // --- response to its pending request and would wait forever instead of learning that
        // --- this window was not ready yet.
        ipcRenderer?.send("MainToIdeResponse", {
          type: "NotReady",
          correlationId: msg.correlationId,
          sourceId: "ide"
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
