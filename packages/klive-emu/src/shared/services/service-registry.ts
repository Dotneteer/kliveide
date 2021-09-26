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
// Predefined service IDs

export const STORE_SERVICE = "store-service";
export const THEME_SERVICE = "theme-service";
export const MODAL_DIALOG_SERVICE = "modal-dialog-service";
export const ACTIVITY_SERVICE = "activity-service";
export const SIDE_BAR_SERVICE = "side-bar-service";
export const ENGINE_PROXY_SERVICE = "engine-proxy-service";
export const PROJECT_SERVICE = "project-service";
export const CONTEXT_MENU_SERVICE = "context-menu-service";
