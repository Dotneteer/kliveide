// ============================================================================
// This file contains helper methods to access the service instances. Each 
// service has a related `get<ServiceName>` method to query the service instance.
//
// You can cache the service instance within a class or a method.
// ============================================================================

import { AppState } from "@state/AppState";
import { KliveStore } from "@state/KliveStore";
import { KliveAction } from "@state/state-core";
import { IInteractiveCommandService } from "@abstractions/interactive-command";
import { IContextMenuService } from "@abstractions/context-menu-service";
import { IDocumentService } from "@abstractions/document-service";
import { IEditorService } from "@abstractions/editor-service";
import { IEngineProxyService } from "@abstractions/engine-proxy-service";
import { IInteractivePaneService } from "@abstractions/interactive-pane-service";
import { IModalDialogService } from "@abstractions/modal-dialog-service";
import { IOutputPaneService } from "@abstractions/output-pane-service";
import { IProjectService } from "@abstractions/project-service";
import { ISideBarService } from "@abstractions/side-bar-service";
import { IThemeService } from "@abstractions/theme-service";
import { IToolAreaService } from "@abstractions/tool-area-service";
import {
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
  VM_ENGINE_SERVICE,
} from "@abstractions/service-registry";
import { IVmEngineService as IVmEngineService } from "./vm-controller-service";

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
export function getCommandService(): IInteractiveCommandService {
  return getService(COMMAND_SERVICE) as IInteractiveCommandService;
}


/**
 * Gets the virtual machine service instance
 */
 export function getVmEngineService(): IVmEngineService {
  return getService(VM_ENGINE_SERVICE) as IVmEngineService;
}
