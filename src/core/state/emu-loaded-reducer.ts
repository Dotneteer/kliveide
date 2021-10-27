import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const emuLoadUiAction: ActionCreator = () => ({ type: "EMU_UI_LOADED" });

// ============================================================================
// Reducer

const initialState = false;

export default function (state = initialState, { type }: KliveAction): boolean {
  switch (type) {
    case "EMU_UI_LOADED":
      return true;
    default:
      return state;
  }
}
