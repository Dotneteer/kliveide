import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  Channel,
  RequestMessage,
  ResponseMessage,
} from "@messaging/message-types";

/**
 * This class sends messages from main to the emulator window
 */
export class MainToEmulatorMessenger extends MessengerBase {
  /**
   * Initializes the listener that processes responses
   */
  constructor(public readonly window: BrowserWindow) {
    super();
    ipcMain.on(
      this.responseChannel,
      (_ev: IpcMainEvent, response: ResponseMessage) =>
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
  readonly requestChannel: Channel = "MainToEmuRequest";

  /**
   * The channel to listen for responses
   */
  readonly responseChannel: Channel = "MainToEmuResponse";
}
