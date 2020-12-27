import { ipcRenderer, IpcRendererEvent } from "electron";
import {
  MAIN_REQUEST_CHANNEL,
  RENDERER_RESPONSE_CHANNEL,
} from "../shared/utils/channel-ids";
import {
  AddDiagnosticsFrameDataResponse,
  DefaultResponse,
  GetMachineStateResponse,
  GetMemoryContentsResponse,
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import { getVmEngine } from "./machine-loader";
import { MachineState } from "../shared/machines/machine-state";

/**
 * Processes messages from the renderer process
 * @param message Message from the renderer
 */
export async function processMessageFromMain(
  message: RequestMessage
): Promise<ResponseMessage> {
  const machine = await getVmEngine();
  switch (message.type) {
    case "injectCode": {
      await machine.injectCode(message.codeToInject);
      return <DefaultResponse>{ type: "ack" };
    }

    case "runCode": {
      await machine.runCode(message.codeToInject, message.debug);
      return <DefaultResponse>{ type: "ack" };
    }

    case "getMemoryContents": {
      const contents = machine.z80Machine.getMemoryContents();
      return <GetMemoryContentsResponse>{
        type: "getMemoryContentsResponse",
        contents,
      };
    }

    case "getMachineState": {
      const state = machine.z80Machine.getMachineState();
      return <GetMachineStateResponse>{
        type: "getMachineStateResponse",
        state,
      };
    }

    case "addDiagnosticsFrameData": {
      machine.z80Machine.addDiagnosticsFrameData(
        message.frame,
        machine.getMachineState() as MachineState
      );
      return <AddDiagnosticsFrameDataResponse>{
        type: "addDiagnosticsFrameDataResponse",
        frame: message.frame,
      };
    }

    case "setBreakpoints": {
      machine.setBreakpoints(message.breakpoints);
      return <DefaultResponse>{
        type: "ack"
      };
    }

    default:
      return <DefaultResponse>{ type: "ack" };
  }
}

// --- Set up message processing
ipcRenderer.on(
  MAIN_REQUEST_CHANNEL,
  async (_ev: IpcRendererEvent, message: RequestMessage) => {
    const response = await processMessageFromMain(message);
    response.correlationId = message.correlationId;
    ipcRenderer.send(RENDERER_RESPONSE_CHANNEL, response);
  }
);
