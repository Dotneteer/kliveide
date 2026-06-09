import { createEmuApi } from "../common/messaging/EmuApi";
import type { EmuMachineCommand } from "../common/messaging/EmuApi";
import { EmuToMainMessenger } from "../common/messaging/EmuToMainMessenger";
import { createIdeApi } from "../common/messaging/IdeApi";
import { IdeToMainMessenger } from "../common/messaging/IdeToMainMessenger";
import { createMainApi } from "../common/messaging/MainApi";
import {
  defaultResponse,
  errorResponse,
  type ApiMethodRequest,
  type Channel,
  type RequestMessage,
  type ResponseMessage
} from "../common/messaging/messages-core";
import {
  issueMachineCommandAction,
  setGlobalSettingAction,
  setMachineTypeAction,
  setThemeAction
} from "../common/state/actions";
import {
  dispatchSharedAction,
  getSharedState,
  setMainApi,
  setRendererActionForwarder,
  windowKind
} from "./shared-store";

const messenger = windowKind === "emu" ? new EmuToMainMessenger() : new IdeToMainMessenger();
setRendererActionForwarder((message) => messenger.sendMessage(message));

const mainApi = createMainApi(messenger);
setMainApi(mainApi);
const emuApi = createEmuApi(messenger);
const ideApi = createIdeApi(messenger);

let latestStatus = `${windowKind.toUpperCase()} renderer is ready.`;

registerMainToRendererChannel(
  windowKind === "emu" ? "MainToEmu" : "MainToIde",
  windowKind === "emu" ? "MainToEmuResponse" : "MainToIdeResponse"
);

window.kliveDemo = {
  getWindowKind: () => windowKind,
  getLatestStatus: () => latestStatus,
  getTheme: () => getSharedState().theme,
  readMainPublicFile: async () => {
    const text = await mainApi.readTextFile("demo-message.txt", "utf8", "public");
    return rememberStatus(`MainApi.readTextFile returned: ${text.trim()}`);
  },
  askIdeToShowMemory: async () => {
    await window.electronShell.openIde();
    await ideApi.showMemory(true);
    return rememberStatus("Sent IdeApi.showMemory(true) through the main process.");
  },
  askEmuToSetMachineType: async () => {
    await emuApi.setMachineType("zx-spectrum-48", "demo", { source: "IDE demo button" });
    return rememberStatus("Sent EmuApi.setMachineType(...) through the main process.");
  },
  toggleTheme: () => {
    const nextTheme = getSharedState().theme === "dark" ? "light" : "dark";
    dispatchSharedAction(setThemeAction(nextTheme));
    return rememberStatus(`Dispatched SET_THEME(${nextTheme}) from ${windowKind.toUpperCase()}.`);
  }
};

export function getDemoStatus(): string {
  return latestStatus;
}

function registerMainToRendererChannel(requestChannel: Channel, responseChannel: Channel): void {
  window.electron.ipcRenderer.on(requestChannel, async (_event, message) => {
    const response = await processMainToRendererMessage(message as RequestMessage);
    window.electron.ipcRenderer.send(responseChannel, {
      ...response,
      correlationId: (message as RequestMessage).correlationId
    });
  });
}

async function processMainToRendererMessage(message: RequestMessage): Promise<ResponseMessage> {
  switch (message.type) {
    case "ForwardAction":
      dispatchSharedAction(message.action, message.sourceId);
      rememberStatus(
        `Received forwarded Redux action ${message.action.type} from ${message.sourceId}.`
      );
      return defaultResponse();

    case "ApiMethodRequest":
      return processApiMethodRequest(message);
  }
}

async function processApiMethodRequest(message: ApiMethodRequest): Promise<ResponseMessage> {
  const processor = windowKind === "emu" ? new EmuMessageProcessor() : new IdeMessageProcessor();
  const processingMethod = processor[message.method as keyof typeof processor];
  if (typeof processingMethod !== "function") {
    return errorResponse(`Unknown ${windowKind} method ${message.method}`);
  }

  try {
    return {
      type: "ApiMethodResponse",
      result: await (processingMethod as (...args: unknown[]) => unknown).call(
        processor,
        ...message.args
      )
    };
  } catch (err) {
    console.error(`Error processing ${windowKind} API method (${message.method}):`, err);
    return errorResponse(String(err));
  }
}

class EmuMessageProcessor {
  async setMachineType(machineId: string, modelId?: string, config?: Record<string, unknown>) {
    dispatchSharedAction(setMachineTypeAction(machineId, modelId, config), "emu");
    rememberStatus(
      `EmuApi.setMachineType received machine=${machineId}, model=${modelId ?? "(none)"}.`
    );
  }

  async issueMachineCommand(command: EmuMachineCommand) {
    issueDemoMachineCommand(command, "emu");
    rememberStatus(`EmuApi.issueMachineCommand received command=${command}.`);
  }
}

class IdeMessageProcessor {
  async showMemory(show: boolean) {
    dispatchSharedAction(setGlobalSettingAction("demo.ideMemoryVisible", show), "main");
    rememberStatus(`IdeApi.showMemory received show=${show}.`);
  }
}

function rememberStatus(status: string): string {
  latestStatus = status;
  console.info(`[${windowKind}] ${status}`);
  return status;
}

function issueDemoMachineCommand(command: EmuMachineCommand, source: "main" | "emu" = "emu"): void {
  dispatchSharedAction(issueMachineCommandAction(command), source);
}
