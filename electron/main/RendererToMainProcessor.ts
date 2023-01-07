import {
  defaultResponse,
  errorResponse,
  RequestMessage,
  ResponseMessage
} from "../../common/messaging/messages-core";
import * as path from "path";
import * as fs from "fs";
import { BrowserWindow, dialog } from "electron";
import {
  textContentsResponse,
  binaryContentsResponse
} from "../../common/messaging/any-to-main";
import { sendFromMainToEmu } from "../../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processRendererToMainMessages (
  message: RequestMessage,
  window: BrowserWindow
): Promise<ResponseMessage> {
  switch (message.type) {
    case "MainReadTextFile":
      // --- A client want to read the contents of a text file
      try {
        const contents = fs.readFileSync(resolvePublicFilePath(message.path), {
          encoding: (message.encoding ?? "utf8") as BufferEncoding
        });
        return textContentsResponse(contents);
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainReadBinaryFile":
      // --- A client want to read the contents of a binary file
      try {
        const contents = fs.readFileSync(resolvePublicFilePath(message.path));
        return binaryContentsResponse(contents);
      } catch (err) {
        return errorResponse(err.toString());
      }

    case "MainDisplayMessageBox":
      // --- A client wants to display an error message.
      // --- We intentionally do not wait for confirmation.
      dialog.showMessageBox(window, {
        type: message.messageType ?? "none",
        title: message.title,
        message: message.message
      });
      break;

    case "EmuMachineCommand":
      // --- A client wants to send a machine command (start, pause, stop, etc.)
      // --- Send this message to the emulator
      return await sendFromMainToEmu(message);

    case "DisplayOutput":
      // --- A client wants to display an output message
      return await sendFromMainToIde(message);

    // --- Forward these messages to the emulator
    case "EmuGetCpuState":
    case "EmuGetUlaState":
      return sendFromMainToEmu(message);
  }
  return defaultResponse();
}

/**
 * Resolves the specified path using the public folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
function resolvePublicFilePath (toResolve: string): string {
  return path.isAbsolute(toResolve)
    ? toResolve
    : path.join(process.env.PUBLIC, toResolve);
}
