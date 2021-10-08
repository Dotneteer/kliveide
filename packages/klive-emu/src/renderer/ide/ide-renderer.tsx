import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { registerThemes } from "../common-ui/register-themes";
import IdeApp from "./IdeApp";
import {
  CODE_RUNNER_SERVICE,
  COMMAND_SERVICE,
  CONTEXT_MENU_SERVICE,
  DIALOG_SERVICE,
  dispatch,
  DOCUMENT_SERVICE,
  EDITOR_SERVICE,
  ENGINE_PROXY_SERVICE,
  getState,
  getStore,
  INTERACTIVE_PANE_SERVICE,
  MODAL_DIALOG_SERVICE,
  OUTPUT_PANE_SERVICE,
  PROJECT_SERVICE,
  registerService,
  SIDE_BAR_SERVICE,
  STORE_SERVICE,
  THEME_SERVICE,
  TOOL_AREA_SERVICE,
} from "@extensibility/service-registry";
import { KliveStore } from "@state/KliveStore";
import { applyMiddleware, combineReducers, createStore } from "redux";
import { IpcRendereApi } from "../../exposed-apis";
import { RendererToMainStateForwarder } from "../common-ui/RendererToMainStateForwarder";
import {
  IDE_SOURCE,
  RENDERER_STATE_REQUEST_CHANNEL,
} from "@messaging/channels";
import { KliveAction } from "@state/state-core";
import { appReducers } from "@state/app-reducers";
import { AppState, getInitialAppState } from "@state/AppState";
import { ForwardActionRequest } from "@messaging/message-types";
import { SideBarService } from "./side-bar/SideBarService";
import { EngineProxyService } from "./engine-proxy";
import { ProjectService } from "./explorer-tools/ProjectService";
import { ContextMenuService } from "./context-menu/ContextMenuService";
import { ThemeService } from "../common-ui/themes/theme-service";
import { ModalDialogService } from "../common-ui/modal-service";
import { DocumentService } from "./document-area/DocumentService";
import { EditorService } from "./editor/editorService";
import { InteractivePaneService } from "./tool-area/InteractiveService";
import { OutputPaneService } from "./tool-area/OutputPaneService";
import { ToolAreaService } from "./tool-area/ToolAreaService";
import { InteractiveCommandService } from "./tool-area/InteractiveCommandService";
import { registerSite } from "@abstractions/process-site";
import { registerCommonCommands } from "@shared/command/common-commands";
import { registerIdeToEmuMessenger } from "@messaging/message-sending";
import { IdeToEmuMessenger } from "./IdeToEmuMessenger";
import { startCommandStatusQuery } from "@abstractions/command-registry";
import { DialogService } from "../common-ui/DialogService";
import { CodeRunnerService } from "../machines/CodeRunnerService";

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
// --- Sign we are in the emulator renderer process

registerSite("ide");
registerCommonCommands();


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
registerService(THEME_SERVICE, new ThemeService());
registerService(MODAL_DIALOG_SERVICE, new ModalDialogService());
registerService(SIDE_BAR_SERVICE, new SideBarService());
registerService(ENGINE_PROXY_SERVICE, new EngineProxyService());
registerService(PROJECT_SERVICE, new ProjectService());
registerService(CONTEXT_MENU_SERVICE, new ContextMenuService());
registerService(DOCUMENT_SERVICE, new DocumentService());
registerService(EDITOR_SERVICE, new EditorService());
registerService(INTERACTIVE_PANE_SERVICE, new InteractivePaneService());
registerService(OUTPUT_PANE_SERVICE, new OutputPaneService());
registerService(TOOL_AREA_SERVICE, new ToolAreaService());
registerService(COMMAND_SERVICE, new InteractiveCommandService());
registerService(DIALOG_SERVICE, new DialogService());
registerService(CODE_RUNNER_SERVICE, new CodeRunnerService());

// --- Register meesenger objects
registerIdeToEmuMessenger(new IdeToEmuMessenger());

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

// --- Start idle command status refresh
startCommandStatusQuery();

ReactDOM.render(
  <Provider store={getStore().store}>
    <IdeApp />
  </Provider>,
  document.getElementById("app")
);
