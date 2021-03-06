import { BrowserWindow } from "electron";
import { RequestMessage } from "../shared/messaging/message-types";

/**
 * Defines the available services of AppWindow
 */
export interface IAppWindow {
  /**
   * Gets the associated BrowserWindow
   */
  readonly window: BrowserWindow | null;

  /**
   * Sets up the application menu
   */
  setupMenu(): void;
  
  /**
   * Posts a message from the renderer to the main
   * @param message Message contents
   */
  postMessageToRenderer(message: RequestMessage): void;

  /**
   * Requests a machine type according to its menu ID
   * @param id Machine type, or menu ID of the machine type
   * @param options Machine construction options
   */
  requestMachineType(id: string, options?: Record<string, any>): void;
}
