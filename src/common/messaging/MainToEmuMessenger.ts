import type { EmuApi } from "./EmuApi";
import type { Channel, RequestMessage, ResponseMessage } from "./messages-core";

import { MessengerBase } from "./MessengerBase";
import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import { createEmulatorApi } from "./EmuApi";

/**
 * Implements a messenger that forwards messages from the Main process to the Emu process
 */
class MainToEmuMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor(public readonly window: BrowserWindow) {
    super();
    ipcMain?.on(this.responseChannel, (_ev: IpcMainEvent, response: ResponseMessage) =>
      this.processResponse(response)
    );
  }

  /**
   * Sends out the message
   * @param message Message to send
   */
  protected send(message: RequestMessage): void {
    if (this.window?.isDestroyed() === false) {
      this.window.webContents.send(this.requestChannel, message);
    }
  }

  /**
   * The channel to send the request out
   */
  get requestChannel(): Channel {
    return "MainToEmu";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): Channel {
    return "MainToEmuResponse";
  }
}

/**
 * The singleton messenger instance of the messenger
 */
let mainToEmuMessenger: MainToEmuMessenger | undefined;
let emuApiInstance: EmuApi | undefined;

/**
 * Registers the messenger to be used with the main process.
 * @param window The browser window to use as the message target
 */
export function registerMainToEmuMessenger(window: BrowserWindow) {
  mainToEmuMessenger = new MainToEmuMessenger(window);
  emuApiInstance = createEmulatorApi(mainToEmuMessenger);
}

/**
 * Sends the specified message from the main process to Ide
 * @param message Message to send
 * @returns Response
 */
export function sendFromMainToEmu<TResp extends ResponseMessage>(
  message: RequestMessage
): Promise<TResp> | null {
  return mainToEmuMessenger ? mainToEmuMessenger.sendMessage(message) : null;
}

/**
 * Gets the EmuApi instance
 */
export function getEmuApi(): EmuApi {
  return emuApiInstance;
}