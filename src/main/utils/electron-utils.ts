/**
 * Tests if the current Electron shell application runs in development mode
 */
export const __DEV__ = process.env.NODE_ENV === "development";

/**
 * Tests if the current Electron shell application runs on Windows
 */
export const __WIN32__ = process.platform === "win32";

/**
 * Tests if the current Electron shell application runs on Mac OS
 */
export const __DARWIN__ = process.platform === "darwin";

/**
 * Tests if the current Electron shell application runs on Linux
 */
export const __LINUX__ = process.platform === "linux";

/**
 * Creates a machine ID from a menu ID
 * @param menuId Menu identifier
 */
export function machineIdFromMenuId(menuId: string): string {
  return menuId.split("_").slice(1).join("_");
}

/**
 * Creates a menu ID from a machine ID
 * @param machineId Machine ID
 */
export function menuIdFromMachineId(machineId: string): string {
  return `machine_${machineId}`;
}

/**
 * Gets the current home folder
 */
export function getHomeFolder(): string {
  return process.env[__WIN32__ ? "USERPROFILE" : "HOME"];
}
