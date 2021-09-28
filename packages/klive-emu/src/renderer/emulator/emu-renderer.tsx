import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { registerThemes } from "../common-ui/register-themes";
import EmuApp from "./EmuApp";
import {
  MODAL_DIALOG_SERVICE,
  registerService,
  STORE_SERVICE,
  THEME_SERVICE,
} from "../../abstractions/service-registry";
import { dispatch, getState, getStore } from "../../abstractions/service-helpers";
import { KliveStore } from "../../shared/state/KliveStore";
import { applyMiddleware, combineReducers, createStore } from "redux";
import { getInitialAppState } from "../../shared/state/AppState";
import { appReducers } from "../../shared/state/app-reducers";
import { EMU_SOURCE, RENDERER_STATE_REQUEST_CHANNEL } from "../../shared/messaging/channels";
import { ForwardActionRequest } from "../../shared/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import { RendererToMainStateForwarder } from "../common-ui/RendererToMainStateForwarder";
import { KliveAction } from "../../shared/state/state-core";
import { ThemeService } from "../common-ui/themes/theme-service";
import { ModalDialogService } from "../common-ui/modal-service";

// ------------------------------------------------------------------------------
// Initialize the forwarder that sends application state changes to the main
// process to keep the same state in each process

// --- Electron APIs exposed for the renderer process
const ipcRenderer = globalThis.window
  ? ((window as any).ipcRenderer as IpcRendereApi)
  : null;

// --- This instance forwards renderer actions to the main process
const forwarder = new RendererToMainStateForwarder(EMU_SOURCE);

// Indicates if we're in forwarding mode
let isForwarding = false;

// --- This middleware function forwards the action originated in the main process
// --- to the renderer processes of browser windows.
const forwardToMainMiddleware = () => (next: any) => (action: KliveAction) => {
  if (!isForwarding) {
    forwarder.forwardAction(action);
  }
  return next(action);
};

// ------------------------------------------------------------------------------
// --- Register the main services

// --- Application state store (redux)
registerService(
  STORE_SERVICE,
  new KliveStore(
    createStore(
      combineReducers(appReducers),
      getInitialAppState(),
      applyMiddleware(forwardToMainMiddleware)
    )
  )
);

// --- Register additional services
registerService(THEME_SERVICE, new ThemeService());
registerService(MODAL_DIALOG_SERVICE, new ModalDialogService());

// --- Prepare the themes used in this app
registerThemes(getState().isWindows ?? false);

// --- Start the listener that processes state changes coming
// --- from the main process

ipcRenderer?.on(
  RENDERER_STATE_REQUEST_CHANNEL,
  (_ev, msg: ForwardActionRequest) => {
    isForwarding = true;
    try {
      dispatch(msg.action);
    } finally {
      isForwarding = false;
    }
  }
);

// --- Render the main component of the emulator window
ReactDOM.render(
  <Provider store={getStore().store}>
    <EmuApp></EmuApp>
  </Provider>,
  document.getElementById("app")
);
