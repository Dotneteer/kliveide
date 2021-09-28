// ============================================================================
// This file contains helper methods to access the service instances. Each 
// service has a related `get<ServiceName>` method to query the service instance.
//
// You can cache the service instance within a class or a method.
// ============================================================================

import { AppState } from "@state/AppState";
import { KliveStore } from "@state/KliveStore";
import { KliveAction } from "@state/state-core";
import { IActivityService } from "./activity-service";
import { ICommandService } from "@shared/services/ICommandService";
import { IContextMenuService } from "@shared/services/IContextMenuService";
import { IDocumentService } from "@shared/services/IDocumentService";
import { IEditorService } from "@shared/services/IEditorService";
import { IEngineProxyService } from "@shared/services/IEngineProxyService";
import { IInteractivePaneService } from "@shared/services/IInteractivePaneService";
import { IModalDialogService } from "@shared/services/IModalDialogService";
import { IOutputPaneService } from "@shared/services/IOutputPaneService";
import { IProjectService } from "@shared/services/IProjectService";
import { ISideBarService } from "@shared/services/ISidebarService";
import { IThemeService } from "@shared/services/IThemeService";
import { IToolAreaService } from "@shared/services/IToolAreaService";
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
} from "@abstractions/service-registry";

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
