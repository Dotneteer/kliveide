import { combineReducers, createStore, applyMiddleware } from "redux";
import { appReducers } from "../shared/state/app-reducers";
import { getInitialStateRenderer, forwardToMain, replayActionRenderer } from "../shared/state/redux-core";
import { AppState } from "../shared/state/AppState";
import { StateAwareObject } from "../shared/state/StateAwareObject";

const spectNetApp = combineReducers(appReducers);
const initialState = getInitialStateRenderer();

const store = createStore(
  spectNetApp,
  initialState,
  applyMiddleware(forwardToMain)
);
replayActionRenderer(store);

/**
 * This is the store we can use in the renderer process
 */
export const rendererProcessStore = store;

/**
 * Creates an object that is aware about the renderer process store's state
 * @param propName AppState property name
 */
export const createRendererProcessStateAware = (
  propName: keyof AppState | null = null
) => new StateAwareObject(rendererProcessStore, propName);
