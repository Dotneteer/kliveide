import { Channel, RequestMessage, ResponseMessage } from "./messages-core";
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
  constructor (public readonly window: BrowserWindow) {
    super();
    ipcMain?.on(
      this.responseChannel,
      (_ev: IpcMainEvent, response: ResponseMessage) =>
        this.processResponse(response)
    );
  }

  /**
   * Sends out the message
   * @param message Message to send
   */
  protected send (message: RequestMessage): void {
    if (this.window?.isDestroyed() === false) {
      this.window.webContents.send(this.requestChannel, message);
    }
  }

  /**
   * The channel to send the request out
   */
  get requestChannel (): Channel {
    return "MainToIde";
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel (): Channel {
    return "MainToIdeResponse";
  }
}

/**
 * The singleton messenger instance of the messenger
 */
let mainToIdeMessenger: MainToIdeMessenger | undefined;

/**
 * Registers the messenger to be used with the main process.
 * @param window The browser window to use as the message target
 */
export function registerMainToIdeMessenger (window: BrowserWindow) {
  mainToIdeMessenger = new MainToIdeMessenger(window);
}

/**
 * Sends the specified message from the Main process to Ide
 * @param message Message to send
 * @returns Response
 */
export async function sendFromMainToIde<TResp extends ResponseMessage> (
  message: RequestMessage
): Promise<TResp> {
  if (mainToIdeMessenger) {
    return await mainToIdeMessenger.sendMessage(message);
  }
}
