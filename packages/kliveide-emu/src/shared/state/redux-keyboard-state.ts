import { SpectNetAction, createAction } from "./redux-core";
import { KeyboardPanelState } from "./AppState";

export const keyboardShowAction = createAction("KEYBOARD_SHOW");
export const keyboardHideAction = createAction("KEYBOARD_HIDE");

/**
 * This reducer manages keyboard panel state changes
 * @param state Input state
 * @param action Action executed
 */
export function keyboardStateReducer(
  state: KeyboardPanelState = {
    visible: false
  },
  { type }: SpectNetAction
): KeyboardPanelState {
  switch (type) {
    case "KEYBOARD_SHOW":
      return { ...state, visible: true };
    case "KEYBOARD_HIDE":
      return { ...state, visible: false };
  }
  return state;
}