import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const ideFocusAction: ActionCreator = (hasFocus: boolean) => ({
  type: "IDE_FOCUS",
  payload: { hasFocus },
});

// ============================================================================
// Reducer

const initialState = false;

export default function (
  state = initialState,
  { type, payload }: KliveAction
): boolean {
  switch (type) {
    case "IDE_FOCUS":
      return payload.hasFocus;
    default:
      return state;
  }
}
