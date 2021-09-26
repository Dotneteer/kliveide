import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { registerThemes } from "../common-ui/register-themes";
import IdeApp from "./IdeApp";
import {
  ACTIVITY_SERVICE,
  CONTEXT_MENU_SERVICE,
  ENGINE_PROXY_SERVICE,
  PROJECT_SERVICE,
  registerService,
  SIDE_BAR_SERVICE,
  STORE_SERVICE,
} from "../../shared/services/service-registry";
import {
  dispatch,
  getState,
  getStore,
} from "../../shared/services/store-helpers";
import { KliveStore } from "../../shared/state/KliveStore";
import { applyMiddleware, combineReducers, createStore } from "redux";
import { IpcRendereApi } from "../../exposed-apis";
import { RendererToMainStateForwarder } from "../common-ui/RendererToMainStateForwarder";
import {
  IDE_SOURCE,
  RENDERER_STATE_REQUEST_CHANNEL,
} from "../../shared/messaging/channels";
import { KliveAction } from "../../shared/state/state-core";
import { appReducers } from "../../shared/state/app-reducers";
import { AppState, getInitialAppState } from "../../shared/state/AppState";
import { ForwardActionRequest } from "../../shared/messaging/message-types";
import { ActivityService } from "./activity-bar/ActivityService";
import { SideBarService } from "./side-bar/SideBarService";
import { EngineProxyService } from "./engine-proxy";
import { ProjectService } from "./explorer-tools/ProjectService";
import { ContextMenuService } from "./context-menu/ContextMenuService";

// ------------------------------------------------------------------------------
// Initialize the forwarder that sends application state changes to the main
// process to keep the same state in each process

// --- Electron APIs exposed for the renderer process
const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

// --- This instance forwards renderer actions to the main process
const forwarder = new RendererToMainStateForwarder(IDE_SOURCE);

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

const appReducer = combineReducers(appReducers);
const rootReducer = (state: AppState, action: KliveAction) => {
  if (action.type === "IDE_SYNC") {
    return appReducer({ ...action.payload.appState } as any, action);
  }
  return appReducer(state as any, action);
};

// ------------------------------------------------------------------------------
// --- Register the main services

// --- Register the store service
registerService(
  STORE_SERVICE,
  new KliveStore(
    createStore(
      rootReducer,
      getInitialAppState(),
      applyMiddleware(forwardToMainMiddleware)
    )
  )
);

// --- Register additional services
registerService(ACTIVITY_SERVICE, new ActivityService());
registerService(SIDE_BAR_SERVICE, new SideBarService());
registerService(ENGINE_PROXY_SERVICE, new EngineProxyService());
registerService(PROJECT_SERVICE, new ProjectService());
registerService(CONTEXT_MENU_SERVICE, new ContextMenuService());

// --- Prepare the themes used in this app
registerThemes(getState().isWindows ?? false);

ipcRenderer.on(
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

ReactDOM.render(
  <Provider store={getStore().store}>
    <IdeApp />
  </Provider>,
  document.getElementById("app")
);
