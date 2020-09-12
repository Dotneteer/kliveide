import { focusStateReducer } from "./redux-app-focus";
import { windowStateReducer } from "./redux-window-state";
import { AppWindow } from "../../main/AppWindow";
import { emulatorStateReducer } from "./redux-emulator-state";
import { emulatorCommandStateReducer } from "./redux-emulator-command-state";
import { vmInfoStateReducer } from "./redux-vminfo-state";
import { breakpointsStateReducer } from "./redux-breakpoint-state";
import { ideConfigStateReducer } from "./redux-ide-config-state";
import { ideConnectionStateReducer } from "./redux-ide-connection.state";
import { memoryCommandStateReducer } from "./redux-memory-command-state";

/**
 * The set of reducers we use within this application
 */
export const appReducers = {
  appHasFocus: focusStateReducer,
  windowState: windowStateReducer,
  emulatorPanelState: emulatorStateReducer,
  vmInfo: vmInfoStateReducer,
  emulatorCommand: emulatorCommandStateReducer,
  breakpoints: breakpointsStateReducer,
  ideConfiguration: ideConfigStateReducer,
  ideConnection: ideConnectionStateReducer,
  memoryCommand: memoryCommandStateReducer
};

/**
 * Stores the reference to the host browser window
 */
export let appWindow: AppWindow;

/**
 * Sets the referencve to the host browser window
 * @param window Host browser window
 */
export function setAppWindow(window: AppWindow) {
  appWindow = window;
}

