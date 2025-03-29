import { Action } from "./Action";
import { IdeSettings } from "@main/settings";

/**
 * This reducer is used to manage the IDE view properties
 */
export function ideSettingsReducer(state: IdeSettings, { type, payload }: Action): IdeSettings {
  switch (type) {
    case "SET_IDE_DISABLE_AUTO_OPEN_PROJECT":
      return {
        ...state,
        disableAutoOpenProject: payload?.flag
      };

    case "SET_IDE_DISABLE_AUTO_COMPLETE":
      return {
        ...state,
        disableAutoComplete: payload?.flag
      };

    default:
      return state;
  }
}