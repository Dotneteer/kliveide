import { Setting } from "@abstractions/Setting";
import { mainStore } from "@main/main-store";
import { get } from "lodash";
import { KliveGlobalSettings } from "../common/settings/setting-definitions";
import { saveAppSettings } from "./settings";
import { saveKliveProject } from "./projects";

/**
 * Get the specified seeting definition.
 * @param id Setting identifier
 * @returns The setting definition, if found; otherwise, null.
 */
export function getSettingDefinition(id: string): Setting | null {
  const setting = KliveGlobalSettings[id];
  return setting ? { ...setting } : null;
}

/**
 * Gets the value of the specified setting from the main store.
 * @param id Setting identifier
 * @returns The value of the setting, or null if the setting does not exist.
 */
export function getSettingValue(id: string): any {
  const setting = getSettingDefinition(id);
  if (!setting) {
    // --- This setting does not exist
    return null;
  }

  const state = mainStore.getState()?.globalSettings || {};
  return get(state, setting.id, setting.defaultValue);
}

export function setSettingValue(id: string, value: any): void {
  const setting = getSettingDefinition(id);
  if (!setting) {
    // --- This setting does not exist
    return;
  }

  const state = mainStore.getState();
  const currentValue = get(state.globalSettings, setting.id);
  if (currentValue === value) {
    // --- No change
    return;
  }

  // --- Check if the value is valid
  switch (setting.type) {
    case "string":
      if (typeof value !== "string") {
        throw new Error(`Invalid value for setting ${id}: expected string, got ${typeof value}`);
      }
      break;
    case "number":
      if (typeof value !== "number") {
        throw new Error(`Invalid value for setting ${id}: expected number, got ${typeof value}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`Invalid value for setting ${id}: expected boolean, got ${typeof value}`);
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        throw new Error(`Invalid value for setting ${id}: expected array, got ${typeof value}`);
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Invalid value for setting ${id}: expected object, got ${typeof value}`);
      }
      break;
    case "any":
      // --- No validation for "any" type
      break;
  }

  // --- Update the state with the new value
  mainStore.dispatch({
    type: "SET_GLOBAL_SETTING",
    payload: { id, value }
  });

  // --- Save the setting if required
  if (setting.saveWithIde) {
    saveAppSettings();
  }
  if (setting.saveWithProject) {
    saveKliveProject();
  }
}
