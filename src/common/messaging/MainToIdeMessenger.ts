import { createIdeApi, IdeApi } from "./IdeApi";
import type { Channel, RequestMessage, ResponseMessage } from "./messages-core";
import { MessengerBase } from "./MessengerBase";

import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";

/**
 * Implements a messenger that forwards messages to the main
 * process
 */
class MainToIdeMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor(public readonly window: BrowserWindow) {
    super();
    this._requestSeqNo = 1000;
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
    return "MainToIde";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): Channel {
    return "MainToIdeResponse";
  }
}

/**
 * The singleton messenger instance of the messenger
 */
let mainToIdeMessenger: MainToIdeMessenger | undefined;
let ideApiAltInstance: IdeApi | undefined;

/**
 * Registers the messenger to be used with the main process.
 * @param window The browser window to use as the message target
 */
export function registerMainToIdeMessenger(window: BrowserWindow) {
  mainToIdeMessenger = new MainToIdeMessenger(window);
  ideApiAltInstance = createIdeApi(mainToIdeMessenger);
}

/**
 * Gets the main-to-ide messenger instance
 */
export function getMainToIdeMessenger(): MainToIdeMessenger | undefined {
  return mainToIdeMessenger;
}

/**
 * Sends the specified message from the Main process to Ide
 * @param message Message to send
 * @returns Response
 */
export function sendFromMainToIde<TResp extends ResponseMessage>(
  message: RequestMessage
): Promise<TResp> | null {
  return mainToIdeMessenger ? mainToIdeMessenger.sendMessage(message) : null;
}

/**
 * Gets the EmuApi instance
 */
export function getIdeApi(): IdeApi {
  return ideApiAltInstance;
}
