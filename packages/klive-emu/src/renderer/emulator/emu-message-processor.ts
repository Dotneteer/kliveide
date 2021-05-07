import {
  CreateMachineResponse,
  DefaultResponse,
  RequestMessage,
  ResponseMessage,
} from "../../shared/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import { MAIN_TO_EMU_REQUEST_CHANNEL } from "../../shared/messaging/channels";
import { MAIN_TO_EMU_RESPONE_CHANNEL } from "../../shared/messaging/channels";
import { IpcRendererEvent } from "electron";
import { vmEngineService } from "../machines/vm-engine-service";

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
    case "CreateMachine":
      await vmEngineService.setEngine(message.machineId, message.options);
      return <CreateMachineResponse>{
        type: "CreateMachineResponse",
        error: null,
      };
    case "ForwardAppConfig":
      vmEngineService.setAppConfiguration(message.config);
      return <DefaultResponse>{ type: "ack" };

    case "startVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.start();
      }
      return <DefaultResponse>{ type: "ack" };

    case "pauseVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.pause();
      }
      return <DefaultResponse>{ type: "ack" };

    case "stopVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stop();
      }
      return <DefaultResponse>{ type: "ack" };

    case "restartVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.restart();
      }
      return <DefaultResponse>{ type: "ack" };

    case "debugVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.startDebug();
      }
      return <DefaultResponse>{ type: "ack" };

    case "stepIntoVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stepInto();
      }
      return <DefaultResponse>{ type: "ack" };

    case "stepOverVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stepOver();
      }
      return <DefaultResponse>{ type: "ack" };

    case "stepOutVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stepOut();
      }
      return <DefaultResponse>{ type: "ack" };

    case "executeMachineCommand":
      if (vmEngineService.hasEngine) {
        vmEngineService.getEngine().executeMachineCommand(message.command);
      }
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
