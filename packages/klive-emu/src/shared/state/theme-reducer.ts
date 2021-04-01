import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const setThemeAction: ActionCreator = (theme: string) => ({
  type: "SET_THEME",
  payload: { theme },
});

// ============================================================================
// Reducer

const initialState = "dark";

export default function (state = initialState, { type, payload }: KliveAction): string {
  switch (type) {
    case "SET_THEME":
      return payload.theme;
    default:
      return state;
  }
}
