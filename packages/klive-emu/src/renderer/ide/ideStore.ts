import { applyMiddleware, combineReducers, createStore } from "redux";
import { KliveAction } from "../../shared/state/state-core";
import {
  IDE_SOURCE,
  RENDERER_STATE_REQUEST_CHANNEL,
} from "../../shared/messaging/channels";
import { appReducers } from "../../shared/state/app-reducers";
import { RendererToMainStateForwarder } from "../common-ui/RendererToMainStateForwarder";
import { AppState, getInitialAppState } from "../../shared/state/AppState";
import { IpcRendereApi } from "../../exposed-apis";
import { ForwardActionRequest } from "../../shared/messaging/message-types";
import { KliveStore } from "../../shared/state/KliveStore";

// --- Electron APIs exposed for the renderer process
const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

// --- This instance forwards renderer actions to the main process
const forwarder = new RendererToMainStateForwarder(IDE_SOURCE);

// Indicates if we're in forwarding mode
let isForwarding = false;

/**
 * This middleware function forwards the action originated in the main process
 * to the renderer processes of browser windows.
 */
const forwardToMainMiddleware = () => (next: any) => (
  action: KliveAction
) => {
  if (!isForwarding) {
    forwarder.forwardAction(action);
  }
  return next(action);
};

const appReducer = combineReducers(appReducers);
const rootReducer = (state: AppState, action: KliveAction) => {
  if (action.type === "IDE_SYNC") {
    return appReducer({...action.payload.appState} as any, action)
  }
  return appReducer(state as any, action);
}

/**
 * Represents the emuStore replica of the app state
 */
export const ideStore = new KliveStore(createStore(
  rootReducer,
  getInitialAppState(),
  applyMiddleware(forwardToMainMiddleware)
));

ipcRenderer.on(RENDERER_STATE_REQUEST_CHANNEL, (_ev, msg: ForwardActionRequest) => {
  isForwarding = true;
  try {
    ideStore.dispatch(msg.action);
  } finally {
    isForwarding = false;
  }
});
