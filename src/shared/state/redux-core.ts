import { webContents, ipcMain, remote, ipcRenderer } from "electron";
import { Payload } from "./Payload";
import { ActionTypes } from "./ActionTypes";
import { REDUX_ACTION_CHANNEL } from "../utils/channel-ids";

/**
 * The name of the function that serializes the redux state.
 */
const GET_REDUX_STATE_FUNC = "getReduxState";

/**
 * This variable stores the alias registry
 */
export const aliasRegistry = new Map<string, ActionCreator>();

/**
 * Creates an action for setting the activity bar contents
 * @param activity List of activities to set
 */
export function createAction(type: keyof ActionTypes, payload?: Payload): ActionCreator {
  return () => ({ type, payload });
}

/**
 * Creates an aliased action that is executed only in the main process, and the result
 * is broadcasted to the renderer process.
 * @param type Aliased action type
 * @param actionCreator Aliased action creator
 */
export function createAliasedAction(
  type: keyof ActionTypes,
  actionCreator?: ActionCreator
): ActionCreator {
  if (!actionCreator) {
    actionCreator = () => {
      return { type };
    };
  }
  aliasRegistry.set(type, actionCreator);

  return (...args) => ({
    type: "ALIASED",
    payload: (args as any) as Payload,
    meta: {
      trigger: type
    }
  });
}

/**
 * Creates a local action
 * @param type Action type
 */
export function createLocalAction(
  type: keyof ActionTypes,
  payload?: Payload
): SpectNetAction {
  return {
    type,
    payload,
    meta: {
      scope: "local"
    }
  };
}

/**
 * This function is intended to be a redux middleware that allows executing aliased actions.
 *
 * ```typescript
 * const todoApp = combineReducers(reducers);
 *
 * const store = createStore(
 *   todoApp,
 *   initialState, // optional
 *   applyMiddleware(
 *     triggerAlias, // optional, see below
 *     ...otherMiddleware,
 *     forwardToRenderer, // IMPORTANT! This goes last
 *   ),
 * );
 * ```
 */
export const triggerAlias = (_store: any) => (next: any) => (action: SpectNetAction) => {
  if (action.type === "ALIASED" && action.meta && action.meta.trigger) {
    const alias = aliasRegistry.get(action.meta.trigger);
    const args = action && action.payload ? [action.payload] : [];
    action = alias(...args);
  }
  return next(action);
};

/**
 * This middleware function forwards the action originated in the main process
 * to the renderer processes of browser windows.
 */
export const forwardToRenderer = () => (next: any) => (action: SpectNetAction) => {
  if (action.meta && action.meta.scope === "local") {
    return next(action);
  }

  // --- change scope to avoid endless-loop
  const rendererAction = {
    ...action,
    meta: {
      ...action.meta, // --- Keep this for future metadata extension
      scope: "local"
    }
  };

  // --- Broadcast the action to all renderer processes
  const allWebContents = webContents.getAllWebContents();
  allWebContents.forEach(contents => {
    contents.send(REDUX_ACTION_CHANNEL, rendererAction);
  });

  // --- Next middleware element
  return next(action);
};

/**
 * Give renderers a way to sync the current state of the store, but be sure
 * we don't expose any remote objects. In other words, we need our state to
 * be serializable.
 *
 * Refer to https://github.com/electron/electron/blob/master/docs/api/remote.md#remote-objects
 */
export function replayActionMain(store: any) {
  (global as any)[GET_REDUX_STATE_FUNC] = () => JSON.stringify(store.getState());

  ipcMain.on(REDUX_ACTION_CHANNEL, (event, payload) => {
    store.dispatch(payload);
  });
}

/**
 * Gets the initial redux store state to set the initial contents of the store at the
 * renderer side.
 */
export function getInitialStateRenderer() {
  const getReduxState = remote.getGlobal(GET_REDUX_STATE_FUNC);
  if (!getReduxState) {
    throw new Error(
      "Could not find reduxState global in main process, did you forget to call replayActionMain?"
    );
  }
  return JSON.parse(getReduxState());
}

/**
 * This middleware function forwards actions to the main process, provided they
 * are not local-scoped.
 */
export const forwardToMain = (store: any) => (
  next: (arg0: any) => any
) => (action: { meta: { scope: string } }) => {
  if (!action.meta || !action.meta.scope || action.meta.scope !== "local") {
    ipcRenderer.send(REDUX_ACTION_CHANNEL, action);
    return;
  }
  return next(action);
};

/**
 * Replays the action at the renderer side.
 */
export function replayActionRenderer(store: any) {
  ipcRenderer.on(REDUX_ACTION_CHANNEL, (event, payload) => {
    store.dispatch(payload);
  });
}

/**
 * This type definition describes the available metadata types.
 */
interface MetaTypes {
  scope?: "local";
  trigger?: string;
}

/**
 * This interface represents an action that can be used within this project.
 */
export interface SpectNetAction {
  type: keyof ActionTypes;
  payload?: Payload;
  meta?: MetaTypes;
}

/**
 * The signature of an action creator function.
 */
export type ActionCreator = (...args: any) => SpectNetAction;
