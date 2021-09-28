import { AppState } from "../state/AppState";
import { KliveStore } from "../state/KliveStore";
import { KliveAction } from "../state/state-core";
import { IActivityService } from "./IActivityService";
import { ICommandService } from "./ICommandService";
import { IContextMenuService } from "./IContextMenuService";
import { IDocumentService } from "./IDocumentService";
import { IEditorService } from "./IEditorService";
import { IEngineProxyService } from "./IEngineProxyService";
import { IInteractivePaneService } from "./IInteractivePaneService";
import { IModalDialogService } from "./IModalDialogService";
import { IOutputPaneService } from "./IOutputPaneService";
import { IProjectService } from "./IProjectService";
import { ISideBarService } from "./ISidebarService";
import { IThemeService } from "./IThemeService";
import { IToolAreaService } from "./IToolAreaService";
import {
  ACTIVITY_SERVICE,
  COMMAND_SERVICE,
  CONTEXT_MENU_SERVICE,
  DOCUMENT_SERVICE,
  EDITOR_SERVICE,
  ENGINE_PROXY_SERVICE,
  getService,
  INTERACTIVE_PANE_SERVICE,
  MODAL_DIALOG_SERVICE,
  OUTPUT_PANE_SERVICE,
  PROJECT_SERVICE,
  SIDE_BAR_SERVICE,
  STORE_SERVICE,
  THEME_SERVICE,
  TOOL_AREA_SERVICE,
} from "./service-registry";

/**
 * Gets the service instance that provides the application state store
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
 */
export function getThemeService(): IThemeService {
  return getService(THEME_SERVICE) as IThemeService;
}

/**
 * Gets the modal dialog service instance
 */
export function getModalDialogService(): IModalDialogService {
  return getService(MODAL_DIALOG_SERVICE) as IModalDialogService;
}

/**
 * Gets the activity service instance
 */
export function getActivityService(): IActivityService {
  return getService(ACTIVITY_SERVICE) as IActivityService;
}

/**
 * Gets the side bar service instance
 */
export function getSideBarService(): ISideBarService {
  return getService(SIDE_BAR_SERVICE) as ISideBarService;
}

/**
 * Gets the engine proxy service instance
 */
export function getEngineProxyService(): IEngineProxyService {
  return getService(ENGINE_PROXY_SERVICE) as IEngineProxyService;
}

/**
 * Gets the project service instance
 */
export function getProjectService(): IProjectService {
  return getService(PROJECT_SERVICE) as IProjectService;
}

/**
 * Gets the context menu service instance
 */
export function getContextMenuService(): IContextMenuService {
  return getService(CONTEXT_MENU_SERVICE) as IContextMenuService;
}

/**
 * Gets the document service instance
 */
export function getDocumentService(): IDocumentService {
  return getService(DOCUMENT_SERVICE) as IDocumentService;
}

/**
 * Gets the editor service instance
 */
export function getEditorService(): IEditorService {
  return getService(EDITOR_SERVICE) as IEditorService;
}

/**
 * Gets the interactive pane service instance
 */
export function getInteractivePaneService(): IInteractivePaneService {
  return getService(INTERACTIVE_PANE_SERVICE) as IInteractivePaneService;
}

/**
 * Gets the output pane service instance
 */
export function getOutputPaneService(): IOutputPaneService {
  return getService(OUTPUT_PANE_SERVICE) as IOutputPaneService;
}

/**
 * Gets the tool area service instance
 */
export function getToolAreaService(): IToolAreaService {
  return getService(TOOL_AREA_SERVICE) as IToolAreaService;
}

/**
 * Gets the command service instance
 */
export function getCommandService(): ICommandService {
  return getService(COMMAND_SERVICE) as ICommandService;
}
