import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const displayModalAction: ActionCreator = (modalDisplayed: boolean) => ({
  type: "DISPLAY_MODAL",
  payload: { modalDisplayed },
});

// ============================================================================
// Reducer

const initialState = false;

export default function (state = initialState, { type, payload }: KliveAction): boolean {
  switch (type) {
    case "DISPLAY_MODAL":
      return payload.modalDisplayed;
    default:
      return state;
  }
}
