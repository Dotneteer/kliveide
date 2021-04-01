import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const ideLoadUiAction: ActionCreator = () => ({ type: "IDE_UI_LOADED" });

// ============================================================================
// Reducer

const initialState = false;

export default function (state = initialState, { type }: KliveAction): boolean {
  switch (type) {
    case "IDE_UI_LOADED":
      return true;
    default:
      return state;
  }
}
