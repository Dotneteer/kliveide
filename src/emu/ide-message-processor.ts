import { IpcRendererEvent } from "electron";
import { IpcRendereApi } from "../exposed-apis";

import {
  DefaultResponse,
  GetCpuStateResponse,
  GetMachineStateResponse,
  GetMemoryContentsResponse,
  RequestMessage,
  ResponseMessage,
  SupportsCodeInjectionResponse,
} from "@core/messaging/message-types";
import { getVmEngineService } from "@ext-core/vm-engine-service";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

/**
 * Processes the messages arriving from the main process
 * @param message
 */
async function processIdeMessages(
  message: RequestMessage
): Promise<ResponseMessage> {
  const vmEngineService = getVmEngineService();
  switch (message.type) {
    case "StartVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.start();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "PauseVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.pause();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StopVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stop();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "RestartVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.restart();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "DebugVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.startDebug();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StepIntoVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stepInto();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StepOverVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stepOver();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "StepOutVm":
      if (vmEngineService.hasEngine) {
        vmEngineService.stepOut();
      }
      return <DefaultResponse>{ type: "Ack" };

    case "RunCode":
      if (vmEngineService.hasEngine) {
        await vmEngineService.runCode(message.codeToInject, message.debug);
      }
      return <DefaultResponse>{ type: "Ack" };

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

    case "SupportsCodeInjection":
      return <SupportsCodeInjectionResponse>{
        type: "SupportsCodeInjectionResponse",
        supports: vmEngineService.getEngine()?.supportsCodeInjection() ?? false,
      };

    case "InjectCode":
      vmEngineService.getEngine()?.injectCodeToRun(message.codeToInject);
      return <DefaultResponse>{ type: "Ack" };

    default:
      return <DefaultResponse>{ type: "Ack" };
  }
}

// --- Set up message processing
ipcRenderer.on(
  "IdeToEmuEmuRequest",
  async (_ev: IpcRendererEvent, message: RequestMessage) => {
    const response = await processIdeMessages(message);
    response.correlationId = message.correlationId;
    ipcRenderer.send("IdeToEmuEmuResponse", response);
  }
);
