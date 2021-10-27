import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const setWindowsAction: ActionCreator = (isWindows: boolean) => ({
  type: "SET_WINDOWS",
  payload: { isWindows },
});

// ============================================================================
// Reducer

const initialState = false;

export default function (state = initialState, { type, payload }: KliveAction): boolean {
  switch (type) {
    case "SET_WINDOWS":
      return payload.isWindows;
    default:
      return state;
  }
}
