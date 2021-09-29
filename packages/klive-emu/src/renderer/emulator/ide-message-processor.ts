import {
  DefaultResponse,
  GetCpuStateResponse,
  GetMachineStateResponse,
  GetMemoryContentsResponse,
  RequestMessage,
  ResponseMessage,
} from "../../extensibility/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import {
  IDE_TO_EMU_EMU_REQUEST_CHANNEL,
  IDE_TO_EMU_EMU_RESPONSE_CHANNEL,
} from "../../extensibility/messaging/channels";
import { IpcRendererEvent } from "electron";
import { vmEngineService } from "../machines/core/vm-engine-service";

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

    case "GetMemoryContents":
      return <GetMemoryContentsResponse>{
        type: "GetMemoryContentsResponse",
        contents: vmEngineService.getEngine()?.getMemoryContents(),
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
