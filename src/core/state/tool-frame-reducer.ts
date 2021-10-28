import { ToolFrameState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const ideToolFrameShowAction: ActionCreator = (visible: boolean) => ({
  type: "TOOL_FRAME_SHOW",
  payload: { visible },
});

export const ideToolFrameMaximizeAction: ActionCreator = (
  maximized: boolean
) => ({
  type: "TOOL_FRAME_MAXIMIZE",
  payload: { maximized },
});

export const ideSetToolFrameStateAction: ActionCreator = (
  toolState: Record<string, Record<string, any>>
) => ({
  type: "SET_TOOL_FRAME_STATE",
  payload: {
    toolState,
  },
});

// ============================================================================
// Reducer

const initialState: ToolFrameState = {
  visible: true,
  maximized: false,
  state: {},
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): ToolFrameState {
  switch (type) {
    case "TOOL_FRAME_SHOW":
      return { ...state, visible: payload.visible };
    case "TOOL_FRAME_MAXIMIZE":
      return { ...state, maximized: payload.maximized };
    case "SET_TOOL_FRAME_STATE":
      return { ...state, state: payload.toolState };
    default:
      return state;
  }
}
