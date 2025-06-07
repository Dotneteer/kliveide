import { Action } from "./Action";
import { AppState, initialAppState } from "./AppState";
import { appStateFlagsReducer } from "./app-state-flags-reducer";
import { ActionForwarder, createStore, Reducer } from "./redux-light";

/**
 * Implements the reducer for managing the application state
 * @param state Current application state
 * @param action State-changing action
 * @returns New application state
 */
function appReducer(state: AppState, action: Action): AppState {
  state = appStateFlagsReducer(state, action);
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
