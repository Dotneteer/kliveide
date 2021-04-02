import { applyMiddleware, combineReducers, createStore } from "redux";
import { KliveAction } from "../../shared/state/state-core";
import {
  IDE_SOURCE,
  RENDERER_STATE_REQUEST_CHANNEL,
} from "../../shared/messaging/channels";
import { appReducers } from "../../shared/state/app-reducers";
import { RendererToMainStateForwarder } from "../common/RendererToMainStateForwarder";
import { getInitialAppState } from "../../shared/state/AppState";
import { IpcRendereApi } from "../../exposed-apis";
import { ForwardActionRequest } from "../../shared/messaging/message-types";

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

/**
 * Represents the emuStore replica of the app state
 */
export const ideStore = createStore(
  combineReducers(appReducers),
  getInitialAppState(),
  applyMiddleware(forwardToMainMiddleware)
);

ideStore.subscribe(() => {
  console.log(JSON.stringify(ideStore.getState()));
})

ipcRenderer.on(RENDERER_STATE_REQUEST_CHANNEL, (_ev, msg: ForwardActionRequest) => {
  isForwarding = true;
  try {
    ideStore.dispatch(msg.action);
  } finally {
    isForwarding = false;
  }
});
