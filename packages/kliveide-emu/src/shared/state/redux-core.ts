import { Payload } from "./Payload";
import { ActionTypes } from "./ActionTypes";

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
