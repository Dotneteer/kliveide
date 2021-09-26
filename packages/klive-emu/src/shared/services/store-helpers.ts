import { AppState } from "../state/AppState";
import { KliveStore } from "../state/KliveStore";
import { KliveAction } from "../state/state-core";
import { getService, STORE_SERVICE } from "./service-registry";

/**
 * Gets the service instance that provides the application state store
 * @returns
 */
export function getStore(): KliveStore {
  return getService(STORE_SERVICE) as KliveStore;
}

/**
 * Dispatches the specified action
 * @param action Action to dispatch
 * @returns Dispatched action
 */
export function dispatch(action: KliveAction): KliveAction {
  return getStore().dispatch(action);
}

/**
 * Gets the application state
 * @returns Current application state
 */
export function getState(): AppState {
  return getStore().getState();
}
