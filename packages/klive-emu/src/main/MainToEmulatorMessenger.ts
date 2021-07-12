import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import {
  MAIN_TO_EMU_REQUEST_CHANNEL,
  MAIN_TO_EMU_RESPONE_CHANNEL,
} from "../shared/messaging/channels";
import {
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import { MessengerBase } from "../shared/messaging/MessengerBase";

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
  readonly requestChannel = MAIN_TO_EMU_REQUEST_CHANNEL;

  /**
   * The channel to listen for responses
   */
  readonly responseChannel = MAIN_TO_EMU_RESPONE_CHANNEL;
}
