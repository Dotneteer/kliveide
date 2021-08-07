import { applyMiddleware, combineReducers, createStore } from "redux";
import { KliveAction } from "../../shared/state/state-core";
import {
  EMU_SOURCE,
  RENDERER_STATE_REQUEST_CHANNEL,
} from "../../shared/messaging/channels";
import { appReducers } from "../../shared/state/app-reducers";
import { RendererToMainStateForwarder } from "../common-ui/RendererToMainStateForwarder";
import { getInitialAppState } from "../../shared/state/AppState";
import { IpcRendereApi } from "../../exposed-apis";
import { ForwardActionRequest } from "../../shared/messaging/message-types";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = globalThis.window
  ? ((window as any).ipcRenderer as IpcRendereApi)
  : null;

// --- This instance forwards renderer actions to the main process
const forwarder = new RendererToMainStateForwarder(EMU_SOURCE);

// Indicates if we're in forwarding mode
let isForwarding = false;

/**
 * This middleware function forwards the action originated in the main process
 * to the renderer processes of browser windows.
 */
const forwardToMainMiddleware = () => (next: any) => (action: KliveAction) => {
  if (!isForwarding) {
    forwarder.forwardAction(action);
  }
  return next(action);
};

/**
 * Represents the emuStore replica of the app state
 */
export const emuStore = createStore(
  combineReducers(appReducers),
  getInitialAppState(),
  applyMiddleware(forwardToMainMiddleware)
);

ipcRenderer?.on(
  RENDERER_STATE_REQUEST_CHANNEL,
  (_ev, msg: ForwardActionRequest) => {
    isForwarding = true;
    try {
      emuStore.dispatch(msg.action);
    } finally {
      isForwarding = false;
    }
  }
);
