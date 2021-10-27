import { EditorState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const hideEditorStatusAction: ActionCreator = () => ({
  type: "EDITOR_STATUS_HIDE",
});
export const showEditorStatusAction: ActionCreator = (
  line: number,
  column: number
) => ({
  type: "EDITOR_STATUS_SHOW",
  payload: { line, column },
});

// ============================================================================
// Reducer

const initialState: EditorState = {
  displayed: false,
  line: -1,
  column: -1,
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): EditorState {
  switch (type) {
    case "EDITOR_STATUS_HIDE":
      return {
        displayed: false,
        line: -1,
        column: -1,
      };
    case "EDITOR_STATUS_SHOW":
      return {
        displayed: true,
        line: payload.line,
        column: payload.column,
      };
    default:
      return state;
  }
}
