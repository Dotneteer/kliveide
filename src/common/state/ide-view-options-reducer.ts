import { Action } from "./Action";
import { IdeViewOptions } from "./AppState";

/**
 * This reducer is used to manage the emulator view option properties
 */
export function ideViewOptionsReducer(
  state: IdeViewOptions,
  { type, payload }: Action
): IdeViewOptions {
  switch (type) {
    case "SET_IDE_FONT_SIZE":
      return { ...state, editorFontSize: payload?.numValue };
    default:
      return state;
  }
}
