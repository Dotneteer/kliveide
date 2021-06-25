import { OutputFrameState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const ideOutputFrameShowAction: ActionCreator = (visible: boolean) => ({
  type: "OUTPUT_FRAME_SHOW",
  payload: { visible },
});

export const ideOutputFrameMaximizeAction: ActionCreator = (
  maximized: boolean
) => ({
  type: "OUTPUT_FRAME_MAXIMIZE",
  payload: { maximized },
});

// ============================================================================
// Reducer

const initialState: OutputFrameState = {
  visible: true,
  maximized: false,
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): OutputFrameState {
  switch (type) {
    case "OUTPUT_FRAME_SHOW":
      return { ...state, visible: payload.visible };
    case "OUTPUT_FRAME_MAXIMIZE":
      return { ...state, maximized: payload.maximized };
    default:
      return state;
  }
}
