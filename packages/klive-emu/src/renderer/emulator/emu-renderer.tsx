import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { registerThemes } from "../../emu-ide/components/register-themes";
import EmuApp from "./EmuApp";
import {
  DIALOG_SERVICE,
  MODAL_DIALOG_SERVICE,
  registerService,
  STORE_SERVICE,
  THEME_SERVICE,
  VM_CONTROLLER_SERVICE,
} from "@core/service-registry";
import { dispatch, getState, getStore } from "@core/service-registry";
import { KliveStore } from "@state/KliveStore";
import { applyMiddleware, combineReducers, createStore } from "redux";
import { getInitialAppState } from "@state/AppState";
import { appReducers } from "@state/app-reducers";
import { ForwardActionRequest } from "@core/messaging/message-types";
import { IpcRendereApi } from "../../exposed-apis";
import { RendererToMainStateForwarder } from "../../emu-ide/components/RendererToMainStateForwarder";
import { KliveAction } from "@state/state-core";
import { ThemeService } from "../../emu-ide/themes/theme-service";
import { ModalDialogService } from "../../emu-ide/services/modal-service";
import { registerSite } from "@abstractions/process-site";
import { registerCommonCommands } from "@abstractions/common-commands";
import { startCommandStatusQuery } from "@abstractions/command-registry";
import { DialogService } from "../../emu-ide/services/dialog-service";
import { getVmEngineService } from "../machines/core/vm-engine-service";

// ------------------------------------------------------------------------------
// Initialize the forwarder that sends application state changes to the main
// process to keep the same state in each process

// --- Electron APIs exposed for the renderer process
const ipcRenderer = globalThis.window
  ? ((window as any).ipcRenderer as IpcRendereApi)
  : null;

// --- This instance forwards renderer actions to the main process
const forwarder = new RendererToMainStateForwarder("emu");

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
// --- Sign we are in the emulator renderer process

registerSite("emu");
registerCommonCommands();

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
registerService(DIALOG_SERVICE, new DialogService());
registerService(VM_CONTROLLER_SERVICE, getVmEngineService());

// --- Prepare the themes used in this app
registerThemes(getState().isWindows ?? false);

// --- Start the listener that processes state changes coming
// --- from the main process

ipcRenderer?.on(
  "RendererStateRequest",
  (_ev, msg: ForwardActionRequest) => {
    isForwarding = true;
    try {
      dispatch(msg.action);
    } finally {
      isForwarding = false;
    }
  }
);

// --- Start idle command status refresh
startCommandStatusQuery();

// --- Render the main component of the emulator window
ReactDOM.render(
  <Provider store={getStore().store}>
    <EmuApp></EmuApp>
  </Provider>,
  document.getElementById("app")
);
