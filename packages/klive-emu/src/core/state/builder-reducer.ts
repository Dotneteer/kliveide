import { BuilderState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const clearBuildRootsAction: ActionCreator = () => ({
  type: "CLEAR_BUILD_ROOTS",
});
export const addBuildRootAction: ActionCreator = (filename: string) => ({
  type: "ADD_BUILD_ROOT",
  payload: { filename },
});
export const removeBuildRootAction: ActionCreator = (filename: string) => ({
  type: "REMOVE_BUILD_ROOT",
  payload: { filename },
});

// ============================================================================
// Reducer

const initialState: BuilderState = {
  roots: [],
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): BuilderState {
  switch (type) {
    case "CLEAR_BUILD_ROOTS":
      return {
        ...state,
        roots: [],
      };
    case "ADD_BUILD_ROOT":
      const roots = state.roots.includes(payload.filename)
        ? state.roots
        : (state.roots.push(payload.filename), state.roots.slice(0));
      return {
        ...state,
        roots,
      };
    case "REMOVE_BUILD_ROOT":
      const rootIndex = state.roots.indexOf(payload.filename);
      const remaining =
        rootIndex >= 0
          ? (state.roots.splice(rootIndex, 1), state.roots.slice(0))
          : state.roots;
      return {
        ...state,
        roots: remaining,
      };
    default:
      return state;
  }
}
