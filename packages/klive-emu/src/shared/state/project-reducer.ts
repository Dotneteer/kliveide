import { ProjectState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const openProjectAction: ActionCreator = (
  path: string,
  projectName: string,
  hasVm: boolean
) => ({
  type: "PROJECT_OPEN",
  payload: { path, projectName, hasVm },
});
export const projectLoadingAction: ActionCreator = (isLoading: boolean) => ({
  type: "PROJECT_LOADING",
  payload: { isLoading },
});
export const closeProjectAction: ActionCreator = () => ({
  type: "PROJECT_CLOSE",
});

// ============================================================================
// Reducer

const initialState: ProjectState = {
  isLoading: false,
  path: null,
  projectName: null,
  hasVm: false,
};

export default function (
  state = initialState,
  { type, payload }: KliveAction
): ProjectState {
  switch (type) {
    case "PROJECT_OPEN":
      return {
        ...state,
        path: payload.path,
        projectName: payload.projectName,
        hasVm: payload.hasVm,
      };
    case "PROJECT_LOADING":
      return { ...state, isLoading: payload.isLoading };
    case "PROJECT_CLOSE":
      return { ...initialState };
    default:
      return state;
  }
}
