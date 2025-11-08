import path from "path";
import fs from "fs";
import _ from "lodash";

import { app, BrowserWindow } from "electron";
import {
  defaultResponse,
  errorResponse,
  RequestMessage,
} from "../common/messaging/messages-core";
import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import {
  getKliveProjectFolder,
  resolveHomeFilePath,
  resolvePublicFilePath,
  resolveSavedFilePath, 
} from "./projects";

import { Dispatch } from "react";
import { Action } from "../common/state/Action";
import { mainStore } from "./mainStore";

class MainMessageProcessor {
  /**
   * Constructs the MainMessageProcessor.
   * @param window The Electron BrowserWindow instance.
   * @param dispatch The Redux dispatch function for actions.
   */
  constructor(
    private readonly window: BrowserWindow,
    private readonly dispatch: Dispatch<Action>
  ) {}

  /**
   * Reads a text file from disk and returns its contents as a string.
   * @param path The file path to read.
   * @param encoding The text encoding to use (default: utf8).
   * @param resolveIn Optional base path context.
   */
  readTextFile(path: string, encoding?: string, resolveIn?: string) {
    if (typeof path !== "string" || !path.trim()) {
      throw new Error("Invalid file path");
    }
    // --- Input validated
    const fullPath = resolveMessagePath(path, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error("File does not exist");
    }
    return fs.readFileSync(fullPath, {
      encoding: (encoding ?? "utf8") as BufferEncoding
    });
  }

  /**
   * Reads a binary file from disk and returns its contents as a Uint8Array.
   * @param path The file path to read.
   * @param resolveIn Optional base path context.
   */
  readBinaryFile(path: string, resolveIn?: string) {
    if (typeof path !== "string" || !path.trim()) {
      throw new Error("Invalid file path");
    }
    // --- Input validated
    const fullPath = resolveMessagePath(path, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error("File does not exist");
    }
    return new Uint8Array(fs.readFileSync(fullPath));
  }

  /**
   * Saves text data to a file and returns the file path.
   * @param savePath The file path to save to.
   * @param data The text data to write.
   * @param resolveIn Optional base path context.
   */
  saveTextFile(savePath: string, data: string, resolveIn?: string) {
    if (typeof savePath !== "string" || !savePath.trim()) {
      throw new Error("Invalid file path");
    }
    if (typeof data !== "string") {
      throw new Error("Data must be a string");
    }
    // --- Input validated
    const filePath = resolveMessagePath(savePath, resolveIn);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { flag: "w" });
    return filePath;
  }

  /**
   * Saves binary data to a file and returns the file path.
   * @param savePath The file path to save to.
   * @param data The binary data to write.
   * @param resolveIn Optional base path context.
   */
  saveBinaryFile(savePath: string, data: Uint8Array, resolveIn?: string) {
    if (typeof savePath !== "string" || !savePath.trim()) {
      throw new Error("Invalid file path");
    }
    if (!(data instanceof Uint8Array)) {
      throw new Error("Data must be a Uint8Array");
    }
    // --- Input validated
    const filePath = resolveMessagePath(savePath, resolveIn);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { flag: "w" });
    return filePath;
  }

  /**
   * Exits the application.
   */
  async exitApp() {
    app.quit();
  }

}

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processRendererToMainMessages(
  message: RequestMessage,
  window: BrowserWindow
): Promise<any> {
  const dispatch = mainStore.dispatch;
  const mainMessageProcessor = new MainMessageProcessor(window, dispatch);

  if (message.targetId === "emu") {
    return await sendFromMainToEmu(message);
  }
  if (message.targetId === "ide") {
    return await sendFromMainToIde(message);
  }

  switch (message.type) {
    case "ApiMethodRequest":
      // --- We accept only methods defined in the MainMessageProcessor
      const processingMethod = mainMessageProcessor[message.method];
      if (typeof processingMethod === "function") {
        try {
          // --- Call the method with the given arguments. We do not call the
          // --- function through the mainMessageProcessor instance, so we need
          // --- to pass it as the "this" parameter.
          return {
            type: "ApiMethodResponse",
            result: await (processingMethod as Function).call(mainMessageProcessor, ...message.args)
          };
        } catch (err) {
          // --- Report the error
          console.error(`Error processing message: ${err}`);
          return errorResponse(err.toString());
        }
      }
      return errorResponse(`Unknown method ${message.method}`);
  }
  return defaultResponse();
}

function resolveMessagePath(inputPath: string, resolveIn?: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;

  const segments = resolveIn?.split(":");
  if (!segments || segments.length === 0) {
    inputPath = resolvePublicFilePath(inputPath);
  } else {
    if (segments.length > 1) inputPath = path.join(segments[1], inputPath);
    switch (segments[0]) {
      case "home":
        inputPath = resolveHomeFilePath(inputPath);
        break;
      case "project":
        inputPath = getKliveProjectFolder(inputPath);
        break;
      case "saveFolder":
        inputPath = resolveSavedFilePath(inputPath);
        break;
      default:
        inputPath = resolvePublicFilePath(inputPath);
        break;
    }
  }
  return inputPath;
}
