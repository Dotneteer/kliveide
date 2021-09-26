import { AppState } from "../state/AppState";
import { KliveStore } from "../state/KliveStore";
import { KliveAction } from "../state/state-core";
import { IActivityService } from "./IActivityService";
import { IContextMenuService } from "./IContextMenuService";
import { IEngineProxyService } from "./IEngineProxyService";
import { IModalDialogService } from "./IModalDialogService";
import { IProjectService } from "./IProjectService";
import { ISideBarService } from "./ISidebarService";
import { IThemeService } from "./IThemeService";
import {
  ACTIVITY_SERVICE,
  CONTEXT_MENU_SERVICE,
  ENGINE_PROXY_SERVICE,
  getService,
  MODAL_DIALOG_SERVICE,
  PROJECT_SERVICE,
  SIDE_BAR_SERVICE,
  STORE_SERVICE,
  THEME_SERVICE,
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
 * Gets the theme service instance
 * @returns
 */
export function getThemeService(): IThemeService {
  return getService(THEME_SERVICE) as IThemeService;
}

/**
 * Gets the modal dialog service instance
 * @returns
 */
 export function getModalDialogService(): IModalDialogService {
  return getService(MODAL_DIALOG_SERVICE) as IModalDialogService;
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

/**
 * Gets the project service instance
 * @returns
 */
export function getProjectService(): IProjectService {
  return getService(PROJECT_SERVICE) as IProjectService;
}

/**
 * Gets the context menu service instance
 * @returns
 */
export function getContextMenuService(): IContextMenuService {
  return getService(CONTEXT_MENU_SERVICE) as IContextMenuService;
}
