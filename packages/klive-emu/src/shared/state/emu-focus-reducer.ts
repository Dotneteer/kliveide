import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const emuFocusAction: ActionCreator = (hasFocus: boolean) => ({
  type: "EMU_FOCUS",
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
    case "EMU_FOCUS":
      return payload.hasFocus;
    default:
      return state;
  }
}
