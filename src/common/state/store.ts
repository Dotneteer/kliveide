import { Action } from "./Action";
import { AppState, initialAppState } from "./AppState";
import { appStateFlagsReducer } from "./app-state-flags-reducer";
import { globalSettingsReducer } from "./global-settings-reducer";
import { ActionForwarder, createStore } from "./redux-light";

/**
 * Implements the reducer for managing the application state
 * @param state Current application state
 * @param action State-changing action
 * @returns New application state
 */
function appReducer(state: AppState, action: Action): AppState {
  state = appStateFlagsReducer(state, action);
  state = globalSettingsReducer(state, action);
  return state;
}

/**
 * Creates an application store using the specified forwarder function
 * @param id Store identifier
 * @param forwarder Optional action forwarder for cross-process communication
 * @returns Store instance managing the application state
 */
export default function createAppStore(id: string, forwarder?: ActionForwarder) {
  // Clone initialAppState so each store has its own independent copy
  const clonedInitialState: AppState = { ...initialAppState };
  return createStore(id, appReducer, clonedInitialState, forwarder);
}
