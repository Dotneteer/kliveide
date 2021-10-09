import { getVmEngineService } from "@core/service-registry";

import {
  CreateMachineResponse,
  DefaultResponse,
  ExecuteMachineCommandResponse,
  RequestMessage,
  ResponseMessage,
} from "@core/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
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
  const vmEngineService = getVmEngineService();
  switch (message.type) {
    case "CreateMachine":
      await vmEngineService.setEngine(message.machineId, message.options);
      return <CreateMachineResponse>{
        type: "CreateMachineResponse",
        error: null,
      };
    case "ForwardAppConfig":
      vmEngineService.setAppConfiguration(message.config);
      return <DefaultResponse>{ type: "Ack" };

    case "StartVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.start();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "PauseVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.pause();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StopVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.stop();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "RestartVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.restart();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "DebugVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.startDebug();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StepIntoVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.stepInto();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StepOverVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.stepOver();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StepOutVm":
      if (vmEngineService.hasEngine) {
        await vmEngineService.stepOut();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "ExecuteMachineCommand":
      if (vmEngineService.hasEngine) {
        const result = await vmEngineService
          .getEngine()
          .executeMachineCommand(message.command, message.args);
        return <ExecuteMachineCommandResponse>{
          type: "ExecuteMachineCommandResponse",
          result,
        };
      }
      return <DefaultResponse>{ type: "Ack" };

    default:
      return <DefaultResponse>{ type: "Ack" };
  }
}

// --- Set up message processing
ipcRenderer.on(
  "MainToEmuRequest",
  async (_ev: IpcRendererEvent, message: RequestMessage) => {
    const response = await processEmulatorMessages(message);
    response.correlationId = message.correlationId;
    ipcRenderer.send("MainToEmuResponse", response);
  }
);
