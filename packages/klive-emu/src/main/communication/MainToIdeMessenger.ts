import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  RequestMessage,
  ResponseMessage,
} from "@messaging/message-types";
import {
  MAIN_TO_IDE_REQUEST_CHANNEL,
  MAIN_TO_IDE_RESPONE_CHANNEL,
} from "@messaging/channels";

/**
 * This class sends messages from main to the emulator window
 */
export class MainToIdeMessenger extends MessengerBase {
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
    this.window.webContents.send(this.requestChannel, message);
  }

  /**
   * The channel to send the request out
   */
  readonly requestChannel = MAIN_TO_IDE_REQUEST_CHANNEL;

  /**
   * The channel to listen for responses
   */
  readonly responseChannel = MAIN_TO_IDE_RESPONE_CHANNEL;
}
