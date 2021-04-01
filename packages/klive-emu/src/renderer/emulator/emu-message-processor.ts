import {
  DefaultResponse,
  RequestMessage,
  ResponseMessage,
} from "../../shared/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import { MAIN_TO_EMU_REQUEST_CHANNEL } from "../../shared/messaging/channels";
import { MAIN_TO_EMU_RESPONE_CHANNEL } from "../../shared/messaging/channels";
import { IpcRendererEvent } from "electron";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

/**
 * Processes the messages arriving from the main process
 * @param message
 */
async function processEmulatorMessages(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "startVm":
      console.log("startVm");
      return <DefaultResponse>{ type: "ack" };

    case "pauseVm":
      console.log("pauseVm");
      return <DefaultResponse>{ type: "ack" };

    case "stopVm":
      console.log("stopVm");
      return <DefaultResponse>{ type: "ack" };

    case "restartVm":
      console.log("restartVm");
      return <DefaultResponse>{ type: "ack" };

    case "debugVm":
      console.log("debugVm");
      return <DefaultResponse>{ type: "ack" };

    case "stepIntoVm":
      console.log("stepIntoVm");
      return <DefaultResponse>{ type: "ack" };

    case "stepOverVm":
      console.log("stepOverVm");
      return <DefaultResponse>{ type: "ack" };

    case "stepOutVm":
      console.log("stepOutVm");
      return <DefaultResponse>{ type: "ack" };

    default:
      return <DefaultResponse>{ type: "ack" };
  }
}

// --- Set up message processing
ipcRenderer.on(
  MAIN_TO_EMU_REQUEST_CHANNEL,
  async (_ev: IpcRendererEvent, message: RequestMessage) => {
    const response = await processEmulatorMessages(message);
    response.correlationId = message.correlationId;
    ipcRenderer.send(MAIN_TO_EMU_RESPONE_CHANNEL, response);
  }
);
