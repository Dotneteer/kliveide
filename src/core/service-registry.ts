// ============================================================================
// Services are singleton objects that provide communication between unrelated
// components of the application. These components use service properties,
// methods, and events for communication.
//
// Each service has a unique identifier string. When the application's
// processes start, they must initialize their supported services before any
// other activities.
// ============================================================================

// ----------------------------------------------------------------------------
// Service interface and DTO imports

import { AppState } from "@state/AppState";
import { KliveStore } from "@state/KliveStore";
import { KliveAction } from "@state/state-core";
import { IInteractiveCommandService } from "@abstractions/interactive-command-service";
import { IContextMenuService } from "@abstractions/context-menu-service";
import { IDocumentService } from "@abstractions/document-service";
import { IInteractivePaneService } from "@abstractions/interactive-pane-service";
import { IModalDialogService } from "@abstractions/modal-dialog-service";
import { IOutputPaneService } from "@abstractions/output-pane-service";
import { IProjectService } from "@abstractions/project-service";
import { ISideBarService } from "@abstractions/side-bar-service";
import { IThemeService } from "@abstractions/theme-service";
import { IToolAreaService } from "@abstractions/tool-area-service";
import { IZ80CompilerService } from "@abstractions/z80-compiler-service";
import { IDialogService } from "@abstractions/dialog-service";
import { ICodeRunnerService } from "@abstractions/code-runner-service";
import { IVmControllerService } from "@abstractions/vm-core-types";
import { ISettingsService } from "@abstractions/settings-service";

// ----------------------------------------------------------------------------
// Predefined service IDs

export const STORE_SERVICE = "store-service";
export const THEME_SERVICE = "theme-service";
export const MODAL_DIALOG_SERVICE = "modal-dialog-service";
export const SIDE_BAR_SERVICE = "side-bar-service";
export const PROJECT_SERVICE = "project-service";
export const CONTEXT_MENU_SERVICE = "context-menu-service";
export const DOCUMENT_SERVICE = "document-service";
export const INTERACTIVE_PANE_SERVICE = "interactive-pane-service";
export const OUTPUT_PANE_SERVICE = "output-pane-service";
export const TOOL_AREA_SERVICE = "tool-area-service";
export const COMMAND_SERVICE = "command-service";
export const Z80_COMPILER_SERVICE = "z80-compiler-service";
export const DIALOG_SERVICE = "dialog-service";
export const CODE_RUNNER_SERVICE = "code-runner-service";
export const VM_CONTROLLER_SERVICE = "vm-controller-service";
export const SETTIINGS_SERVICE = "settings-service";

// ----------------------------------------------------------------------------
// Service registry methods

// --- Store registered service instances here
const services: Record<string, any> = {};

/**
 * Registers a service instance
 * @param id Service ID
 * @param service Service instance
 */
export function registerService(id: string, service: any): void {
  services[id] = service;
}

/**
 * Unregisters the specified service instance
 * @param id
 */
export function unregisterService(id: string): void {
  delete services[id];
}

/**
 * Gets the specified service instance
 * @param id
 * @returns
 */
export function getService(id: string): any {
  const service = services[id];
  if (!service) {
    throw new Error(`Cannot find '${id}' in the service registry`);
  }
  return service;
}

// ----------------------------------------------------------------------------
// Service helper methods

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
 * Gets the Z80 compiler service instance
 */
export function getZ80CompilerService(): IZ80CompilerService {
  return getService(Z80_COMPILER_SERVICE) as IZ80CompilerService;
}

/**
 * Gets the dialog service instance
 */
export function getDialogService(): IDialogService {
  return getService(DIALOG_SERVICE) as IDialogService;
}

/**
 * Gets the code runner service instance
 */
export function getCodeRunnerService(): ICodeRunnerService {
  return getService(CODE_RUNNER_SERVICE) as ICodeRunnerService;
}

/**
 * Gets the VM controller service instance
 */
export function getVmControllerService(): IVmControllerService {
  return getService(VM_CONTROLLER_SERVICE) as IVmControllerService;
}

/**
 * Gets the settings service instance
 */
export function getSettingsService(): ISettingsService {
  return getService(SETTIINGS_SERVICE) as ISettingsService;
}
