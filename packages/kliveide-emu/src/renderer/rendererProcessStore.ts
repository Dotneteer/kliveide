import { combineReducers, createStore, applyMiddleware } from "redux";
import { appReducers } from "@state/app-reducers";
import { AppState, getDefaultAppState } from "@state/AppState";
import { StateAwareObject } from "@state/StateAwareObject";
import { REDUX_ACTION_CHANNEL } from "../shared/utils/channel-ids";
import { IpcRendereApi } from "../exposed-apis";

const spectNetApp = combineReducers(appReducers);
const initialState = getDefaultAppState();

const ipcRenderer = (window as any).ipcRenderer as IpcRendereApi;

/**
 * This middleware function forwards actions to the main process, provided they
 * are not local-scoped.
 */
const forwardToMain = (store: any) => (next: (arg0: any) => any) => (action: {
  meta: { scope: string };
}) => {
  if (!action.meta || !action.meta.scope || action.meta.scope !== "local") {
    ipcRenderer.send(REDUX_ACTION_CHANNEL, action);
    return;
  }
  return next(action);
};

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

/**
 * Replays the action at the renderer side.
 */
function replayActionRenderer(store: any) {
  ipcRenderer.on(REDUX_ACTION_CHANNEL, (_event: any, payload: any) => {
    store.dispatch(payload);
  });
}
