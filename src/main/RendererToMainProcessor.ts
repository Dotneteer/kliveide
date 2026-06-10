import { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import {
  defaultResponse,
  errorResponse,
  type RequestMessage,
  type ResponseMessage
} from "../common/messaging/messages-core";
import { mainStore } from "./main-store";
import { getMainPublicPath } from "./publicResources";
import {
  getAllSettingValues,
  getSettingValue,
  setSettingValue
} from "./settings";

class MainMessageProcessor {
  constructor(private readonly window: BrowserWindow) {}

  readTextFile(filePath: string, encoding?: string, resolveIn?: string): string {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("Invalid file path");
    }

    const fullPath = resolveMessagePath(filePath, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${fullPath}`);
    }

    return fs.readFileSync(fullPath, {
      encoding: (encoding ?? "utf8") as BufferEncoding
    });
  }

  readBinaryFile(filePath: string, resolveIn?: string): Uint8Array {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("Invalid file path");
    }

    const fullPath = resolveMessagePath(filePath, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${fullPath}`);
    }

    return new Uint8Array(fs.readFileSync(fullPath));
  }

  getSettingValue(id: string): unknown {
    return getSettingValue(id);
  }

  setSettingValue(id: string, value: unknown): unknown {
    setSettingValue(id, value);
    return getSettingValue(id);
  }

  getAllSettingValues(): Record<string, unknown> {
    return getAllSettingValues();
  }
}

export async function processRendererToMainMessages(
  message: RequestMessage,
  window: BrowserWindow
): Promise<ResponseMessage> {
  if (message.type === "ForwardAction") {
    mainStore.dispatch(message.action, message.sourceId);
    return defaultResponse();
  }

  if (message.targetId === "emu") {
    const response = await sendFromMainToEmu<ResponseMessage>(message);
    return response ?? errorResponse("Emulator window is not ready.");
  }

  if (message.targetId === "ide") {
    const response = await sendFromMainToIde<ResponseMessage>(message);
    return response ?? errorResponse("IDE window is not ready.");
  }

  const mainMessageProcessor = new MainMessageProcessor(window);
  const processingMethod = mainMessageProcessor[message.method as keyof MainMessageProcessor];
  if (typeof processingMethod !== "function") {
    return errorResponse(`Unknown method ${message.method}`);
  }

  try {
    return {
      type: "ApiMethodResponse",
      result: await (processingMethod as (...args: unknown[]) => unknown).call(
        mainMessageProcessor,
        ...message.args
      )
    };
  } catch (err) {
    console.error(`Error processing message (${message.method}):`, err);
    return errorResponse(String(err));
  }
}

function resolveMessagePath(filePath: string, resolveIn?: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  if (resolveIn === "public") {
    return getMainPublicPath(filePath);
  }

  return path.resolve(process.cwd(), filePath);
}
