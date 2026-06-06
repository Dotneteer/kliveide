import { createEmuApi } from "../common/messaging/EmuApi";
import { EmuToMainMessenger } from "../common/messaging/EmuToMainMessenger";
import { createIdeApi } from "../common/messaging/IdeApi";
import { IdeToMainMessenger } from "../common/messaging/IdeToMainMessenger";
import { createMainApi } from "../common/messaging/MainApi";
import type { MessengerBase } from "../common/messaging/MessengerBase";
import {
  defaultResponse,
  errorResponse,
  type ApiMethodRequest,
  type Channel,
  type RequestMessage,
  type ResponseMessage
} from "../common/messaging/messages-core";
import { setThemeAction, setGlobalSettingAction } from "../common/state/actions";
import createAppStore from "../common/state/store";

type DemoWindowKind = "emu" | "ide";

const windowKind = getWindowKind();
const messenger = windowKind === "emu" ? new EmuToMainMessenger() : new IdeToMainMessenger();
const store = createAppStore(windowKind, async (action, source) => {
  if (source !== windowKind) {
    return;
  }

  await messenger.sendMessage({
    type: "ForwardAction",
    action,
    sourceId: windowKind
  });
});

const mainApi = createMainApi(messenger);
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
  getTheme: () => store.getState().theme,
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
    const nextTheme = store.getState().theme === "dark" ? "light" : "dark";
    store.dispatch(setThemeAction(nextTheme), windowKind);
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
      store.dispatch(message.action, message.sourceId);
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
    store.dispatch(
      setGlobalSettingAction("demo.emuMachine", { machineId, modelId, config }),
      "main"
    );
    rememberStatus(
      `EmuApi.setMachineType received machine=${machineId}, model=${modelId ?? "(none)"}.`
    );
  }
}

class IdeMessageProcessor {
  async showMemory(show: boolean) {
    store.dispatch(setGlobalSettingAction("demo.ideMemoryVisible", show), "main");
    rememberStatus(`IdeApi.showMemory received show=${show}.`);
  }
}

function getWindowKind(): DemoWindowKind {
  return new URLSearchParams(window.location.search).get("window") === "ide" ? "ide" : "emu";
}

function rememberStatus(status: string): string {
  latestStatus = status;
  console.info(`[${windowKind}] ${status}`);
  return status;
}
