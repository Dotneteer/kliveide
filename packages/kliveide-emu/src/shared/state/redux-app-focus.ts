import { SpectNetAction, createAction } from "./redux-core";

export const appGotFocusAction = createAction("APP_GOT_FOCUS");
export const appLostFocusAction = createAction("APP_LOST_FOCUS");

/**
 * This reducer manages application window state changes
 * @param state Input state
 * @param action Action executed
 */
export function focusStateReducer(
  state: boolean = false,
  { type }: SpectNetAction
): boolean {
  switch (type) {
    case "APP_GOT_FOCUS":
      return true;
    case "APP_LOST_FOCUS":
      return false;
  }
  return state;
}
