import {
  DefaultResponse,
  GetCpuStateResponse,
  GetMachineStateResponse,
  RequestMessage,
  ResponseMessage,
} from "../../shared/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import {
  IDE_TO_EMU_EMU_REQUEST_CHANNEL,
  IDE_TO_EMU_EMU_RESPONSE_CHANNEL,
} from "../../shared/messaging/channels";
import { IpcRendererEvent } from "electron";
import { vmEngineService } from "../machines/vm-engine-service";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

/**
 * Processes the messages arriving from the main process
 * @param message
 */
async function processIdeMessages(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "GetCpuState":
      return <GetCpuStateResponse>{
        type: "GetCpuStateResponse",
        state: vmEngineService.getEngine()?.cpu?.getCpuState(),
      };

    case "GetMachineState":
      return <GetMachineStateResponse>{
        type: "GetMachineStateResponse",
        state: vmEngineService.getEngine()?.getMachineState(),
      };

    default:
      return <DefaultResponse>{ type: "Ack" };
  }
}

// --- Set up message processing
ipcRenderer.on(
  IDE_TO_EMU_EMU_REQUEST_CHANNEL,
  async (_ev: IpcRendererEvent, message: RequestMessage) => {
    const response = await processIdeMessages(message);
    response.correlationId = message.correlationId;
    ipcRenderer.send(IDE_TO_EMU_EMU_RESPONSE_CHANNEL, response);
  }
);
