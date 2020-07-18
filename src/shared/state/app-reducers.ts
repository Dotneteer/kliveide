import { focusStateReducer } from "./redux-app-focus";
import { windowStateReducer } from "./redux-window-state";
import { AppWindow } from "../../main/AppWindow";
import { keyboardStateReducer } from "./redux-keyboard-state";
import { emulatorStateReducer } from "./redux-emulator-state";

/**
 * The set of reducers we use within this application
 */
export const appReducers = {
  appHasFocus: focusStateReducer,
  windowState: windowStateReducer,
  keyboardPanelState: keyboardStateReducer,
  emulatorPanelState: emulatorStateReducer
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

