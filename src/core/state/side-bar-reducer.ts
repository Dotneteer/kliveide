// ============================================================================
// Actions

import { SideBarState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

/**
 * Creates an action for setting the activity bar contents
 */
export const setSideBarStateAction: ActionCreator = (
  sideBar: SideBarState
) => ({
  type: "SET_SIDEBAR_STATE",
  payload: {
    sideBar,
  },
});

// ============================================================================
// Reducer

const initialState: SideBarState = {};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): SideBarState {
  switch (type) {
    case "SET_SIDEBAR_STATE":
      return payload.sideBar;
    default:
      return state;
  }
}
