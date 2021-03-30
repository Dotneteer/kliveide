import { combineReducers, createStore, applyMiddleware } from "redux";
import { appReducers } from "../shared/state/app-reducers";
import { MessengerBase } from "../shared/messaging/MessengerBase";
import {
  DefaultResponse,
  ForwardActionMessage,
  RequestMessage,
  ResponseMessage,
} from "../shared/messaging/message-types";
import {
  EMU_SOURCE,
  IDE_SOURCE,
  MAIN_SOURCE,
  MAIN_STATE_RESPONSE_CHANNEL,
  RENDERER_STATE_REQUEST_CHANNEL,
} from "../shared/messaging/channels";
import { KliveAction } from "../shared/state/state-core";
import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import { getInitialAppState } from "../shared/state/AppState";

// Indicates if we're in forwarding mode
let isForwarding = false;

/**
 * This middleware function forwards the action originated in the main process
 * to the renderer processes of browser windows.
 */
const forwardToRendererMiddleware = () => (next: any) => async (
  action: KliveAction
) => {
  if (!isForwarding) {
    ideStateMessenger?.forwardAction(action);
    emuStateMessenger?.forwardAction(action);
  }

  // --- Next middleware element
  return next(action);
};

/**
 * Represents the master replica of the app state
 */
 export const mainStore = createStore(
  combineReducers(appReducers),
  getInitialAppState(),
  applyMiddleware(forwardToRendererMiddleware)
);

/**
 * This class forwards state changes in main to a particular renderer
 */
class MainToRendererStateForwarder extends MessengerBase {
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
   * Forwards the specified application state to the renderer
   * @param state
   */
  async forwardAction(action: KliveAction): Promise<DefaultResponse> {
    return this.sendMessage<DefaultResponse>({
      type: "ForwardAction",
      sourceId: MAIN_SOURCE,
      action,
    });
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
  get requestChannel(): string {
    return RENDERER_STATE_REQUEST_CHANNEL;
  }

  /**
   * The channel to listen for responses
   */
  get responseChannel(): string {
    return MAIN_STATE_RESPONSE_CHANNEL;
  }
}

// --- Messenger instances
let emuStateMessenger: MainToRendererStateForwarder | null = null;
let ideStateMessenger: MainToRendererStateForwarder | null = null;

/**
 * Registers the EmuWindow instance
 * @param window BorwserWindow instance
 */
export function registerEmuWindowForwarder(window: BrowserWindow): void {
  emuStateMessenger = new MainToRendererStateForwarder(window);
}

/**
 * Registers the EmuWindow instance
 * @param window BorwserWindow instance
 */
 export function registerIdeWindowForwarder(window: BrowserWindow): void {
  ideStateMessenger = new MainToRendererStateForwarder(window);
}

/**
 * Forwards the state received from a renderer to the other
 * @param stateMessage
 */
export function forwardRendererState(
  actionMessage: ForwardActionMessage
): void {
  isForwarding = true;
  try {
    mainStore.dispatch(actionMessage.action);
    if (actionMessage.sourceId === EMU_SOURCE && ideStateMessenger) {
      ideStateMessenger.forwardAction(actionMessage.action);
    } else if (actionMessage.sourceId === IDE_SOURCE && emuStateMessenger) {
      emuStateMessenger.forwardAction(actionMessage.action);
    }
  } finally {
    isForwarding = false;
  }
}
