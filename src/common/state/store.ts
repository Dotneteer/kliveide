import { Action } from "./Action";
import { AppState, initialAppState } from "./AppState";
import { appStateFlagsReducer } from "./app-state-flags-reducer";
import { ideViewReducer } from "./ide-view-reducer";
import { ActionForwarder, createStore, Reducer } from "./redux-light";
import { emulatorStateReducer } from "./emulator-state-reducer";
import { projectReducer } from "./project-reducer";
import { compilationReducer } from "./compilation-reducer";
import { mediaReducer } from "./media-reducer";
import { scriptsReducer } from "./scripts-reducer";
import { workspaceSettingsReducer } from "./workspace-settings-reducer";
import { globalSettingsReducer } from "./global-settings-reducer";
import { watchpointsReducer } from "./watchpoints-reducer";

/**
 * Implements the reducer for managing the application state
 * @param state Current application state
 * @param action State-changing action
 * @returns New application state
 */
function appReducer(state: AppState, action: Action): AppState {
  state = appStateFlagsReducer(state, action);
  invokeReducer(state.globalSettings, globalSettingsReducer, (a, n) => (a.globalSettings = n));
  invokeReducer(state.ideView, ideViewReducer, (a, n) => (a.ideView = n));
  invokeReducer(state.emulatorState, emulatorStateReducer, (a, n) => (a.emulatorState = n));
  invokeReducer(state.project, projectReducer, (a, n) => (a.project = n));
  invokeReducer(state.compilation, compilationReducer, (a, n) => (a.compilation = n));
  invokeReducer(state.media, mediaReducer, (a, n) => (a.media = n));
  invokeReducer(state.scripts, scriptsReducer, (a, n) => (a.scripts = n));
  invokeReducer(
    state.workspaceSettings,
    workspaceSettingsReducer,
    (a, n) => (a.workspaceSettings = n)
  );
  invokeReducer(state.watchpoints, watchpointsReducer, (a, n) => (a.watchpoints = n));
  return state;

  /**
   * Invokes a reducer managing a subtree
   * @param subTreeState Current substate managed by the reducer
   * @param reducer Reducer managing a particular subtree state
   * @param stateSetter State setter to set the new subtree state
   */
  function invokeReducer<S>(
    subTreeState: S | undefined,
    reducer: Reducer<S, Action>,
    stateSetter: (appState: AppState, newState: S) => void
  ) {
    if (!subTreeState) return;
    const newSubstate = reducer(subTreeState, action);
    if (newSubstate !== subTreeState) {
      state = { ...state };
      stateSetter(state, newSubstate);
    }
  }
}

/**
 * Creates an application store using the specified forwarder function
 * @param forwarder
 * @returns Store instance managing the application state
 */
export default function createAppStore(id: string, forwarder?: ActionForwarder) {
  return createStore(id, appReducer, initialAppState, forwarder);
}
