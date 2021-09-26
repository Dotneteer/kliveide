import { AppState } from "../state/AppState";
import { KliveStore } from "../state/KliveStore";
import { KliveAction } from "../state/state-core";
import { IActivityService } from "./IActivityService";
import { IEngineProxyService } from "./IEngineProxyService";
import { ISideBarService } from "./ISidebarService";
import {
  ACTIVITY_SERVICE,
  ENGINE_PROXY_SERVICE,
  getService,
  SIDE_BAR_SERVICE,
  STORE_SERVICE,
} from "./service-registry";

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

/**
 * Gets the activity service instance
 * @returns
 */
export function getActivityService(): IActivityService {
  return getService(ACTIVITY_SERVICE) as IActivityService;
}

/**
 * Gets the side bar service instance
 * @returns
 */
export function getSideBarService(): ISideBarService {
  return getService(SIDE_BAR_SERVICE) as ISideBarService;
}

/**
 * Gets the engine proxy service instance
 * @returns
 */
export function getEngineProxyService(): IEngineProxyService {
  return getService(ENGINE_PROXY_SERVICE) as IEngineProxyService;
}
