import {
  RequestMessage,
  NotReadyResponse,
  ResponseMessage,
  errorResponse,
  type MessageSource
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

/**
 * The channels an IDE renderer listens on: the IDE window's own, or a floating document window's
 * (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.2), which answers with its own source so main can
 * route the response to that window's messenger
 */
export type MainToIdeIpcChannels = {
  requestChannel: "MainToIde" | "MainToFloat";
  responseChannel: "MainToIdeResponse" | "MainToFloatResponse";
  sourceId: MessageSource;
  /**
   * The source a forwarded action is replayed with. A floating window replays them as "main": its
   * store forwards the `"ide"` source to main, so replaying an IDE action under its own source would
   * send it straight back.
   */
  forwardedActionSource?: MessageSource;
};

const IDE_CHANNELS: MainToIdeIpcChannels = {
  requestChannel: "MainToIde",
  responseChannel: "MainToIdeResponse",
  sourceId: "ide"
};

export function registerMainToIdeIpc(
  ipcRenderer: IpcRendererLike | undefined = getElectronIpcRenderer(),
  channels: MainToIdeIpcChannels = IDE_CHANNELS
): () => void {
  if (unregisterMainToIdeIpc) {
    return unregisterMainToIdeIpc;
  }
  const { requestChannel, responseChannel, sourceId } = channels;

  const unregister = registerIpcHandler(
    ipcRenderer,
    requestChannel,
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
        ipcRenderer?.send(responseChannel, {
          type: "NotReady",
          correlationId: msg.correlationId,
          sourceId
        } as NotReadyResponse);
        return;
      }

      let response: ResponseMessage;
      try {
        response = channels.forwardedActionSource
          ? await processMainToIdeMessages(
              msg,
              getCachedStore(),
              getCachedAppServices(),
              channels.forwardedActionSource
            )
          : await processMainToIdeMessages(msg, getCachedStore(), getCachedAppServices());
      } catch (err) {
        response = errorResponse(String(err));
      }

      response.correlationId = msg.correlationId;
      response.sourceId = sourceId;
      ipcRenderer?.send(responseChannel, response);
    }
  );

  unregisterMainToIdeIpc = () => {
    unregister();
    unregisterMainToIdeIpc = undefined;
  };
  return unregisterMainToIdeIpc;
}
