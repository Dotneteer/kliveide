import { cloneDeep, set } from "lodash";
import { Action } from "./Action";

/**
 * This reducer is used to manage the IDE view properties
 */
export function globalSettingsReducer(
  state: Record<string, any>,
  { type, payload }: Action
): Record<string, any> {
  switch (type) {
    case "SET_GLOBAL_SETTING":
      if (!payload?.id) {
        return state;
      }
      const oldSettings = cloneDeep(state || {});
      const newSettings = set(oldSettings, payload.id, payload.value);
      return {
        ...newSettings
      };

    default:
      return state;
  }
}
