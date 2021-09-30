import { AppState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const ideShowAction: ActionCreator = (flag: boolean) => ({
  type: "IDE_SHOW",
  payload: { flag },
});
export const ideSyncAction: ActionCreator = (appState: AppState) => ({
  type: "IDE_SYNC",
  payload: { appState },
});

// ============================================================================
// Reducer

const initialState = false;

export default function (
  state = initialState,
  { type, payload }: KliveAction
): boolean {
  switch (type) {
    case "IDE_SHOW":
      return payload.flag;
    default:
      return state;
  }
}
