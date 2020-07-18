import { combineReducers, createStore, applyMiddleware } from "redux";
import { AppState } from "../shared/state/AppState";
import { appReducers } from "../shared/state/app-reducers";
import {
  triggerAlias,
  forwardToRenderer,
  replayActionMain
} from "../shared/state/redux-core";
import { StateAwareObject } from "../shared/state/StateAwareObject";

// --- Set up the store
const defaultState: AppState = {
  appHasFocus: true,
  keyboardPanelState: { visible: false },
};

const spectNetApp = combineReducers(appReducers);
const store = createStore(
  spectNetApp,
  defaultState,
  applyMiddleware(triggerAlias, forwardToRenderer)
);
replayActionMain(store);

/**
 * This is the store we can use in the main process
 */
export const mainProcessStore = store;

/**
 * Creates an object that is aware about the main process store's state
 * @param propName AppState property name
 */
export const createMainProcessStateAware = (
  propName: keyof AppState | null = null
) => new StateAwareObject(mainProcessStore, propName);
