import { ipcRenderer, IpcRendererEvent } from "electron";
import {
  MAIN_REQUEST_CHANNEL,
  RENDERER_RESPONSE_CHANNEL,
} from "../shared/utils/channel-ids";
import {
  DefaultResponse,
  GetMemoryContentsResponse,
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import { getVmEngine } from "./machine-loader";

/**
 * Processes messages from the renderer process
 * @param message Message from the renderer
 */
export async function processMessageFromMain(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "injectCode": {
      const machine = await getVmEngine();
      await machine.injectCode(message.codeToInject);
      return <DefaultResponse>{ type: "ack" };
    }
    case "runCode": {
      const machine = await getVmEngine();
      await machine.runCode(message.codeToInject, message.debug);
      return <DefaultResponse>{ type: "ack" };
    }
    case "getMemoryContents": {
      const machine = await getVmEngine();
      const contents = machine.z80Machine.getMemoryContents();
      return <GetMemoryContentsResponse>{
        type: "getMemoryContentsResponse",
        contents,
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
