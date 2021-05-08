import { AppState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const ideShowAction: ActionCreator = () => ({ type: "IDE_SHOW" });
export const ideHideAction: ActionCreator = () => ({ type: "IDE_HIDE" });
export const ideSyncAction: ActionCreator = (appState: AppState) => ({
  type: "IDE_SYNC",
  payload: { appState },
});

// ============================================================================
// Reducer

const initialState = false;

export default function (state = initialState, { type }: KliveAction): boolean {
  switch (type) {
    case "IDE_SHOW":
      return true;
    case "IDE_HIDE":
      return false;
    default:
      return state;
  }
}
