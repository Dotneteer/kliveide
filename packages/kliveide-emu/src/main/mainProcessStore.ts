import { combineReducers, createStore, applyMiddleware } from "redux";
import { AppState, getDefaultAppState } from "@state/AppState";
import { appReducers } from "@state/app-reducers";
import { triggerAlias, SpectNetAction } from "@state/redux-core";
import { StateAwareObject } from "@state/StateAwareObject";
import { ipcMain, webContents } from "electron";
import { REDUX_ACTION_CHANNEL } from "../shared/utils/channel-ids";

/**
 * The name of the function that serializes the redux state.
 */
const GET_REDUX_STATE_FUNC = "getReduxState";

// --- Set up the store
const defaultState = getDefaultAppState();

/**
 * This middleware function forwards the action originated in the main process
 * to the renderer processes of browser windows.
 */
const forwardToRenderer = () => (next: any) => (action: SpectNetAction) => {
  if (action.meta && action.meta.scope === "local") {
    return next(action);
  }

  // --- change scope to avoid endless-loop
  const rendererAction = {
    ...action,
    meta: {
      ...action.meta, // --- Keep this for future metadata extension
      scope: "local",
    },
  };

  // --- Broadcast the action to all renderer processes
  const allWebContents = webContents.getAllWebContents();
  allWebContents.forEach((contents) => {
    contents.send(REDUX_ACTION_CHANNEL, rendererAction);
  });

  // --- Next middleware element
  return next(action);
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

/**
 * Give renderers a way to sync the current state of the store, but be sure
 * we don't expose any remote objects. In other words, we need our state to
 * be serializable.
 *
 * Refer to https://github.com/electron/electron/blob/master/docs/api/remote.md#remote-objects
 */
function replayActionMain(store: any) {
  (global as any)[GET_REDUX_STATE_FUNC] = () =>
    JSON.stringify(store.getState());

  ipcMain.on(REDUX_ACTION_CHANNEL, (_event, payload) => {
    store.dispatch(payload);
  });
}
