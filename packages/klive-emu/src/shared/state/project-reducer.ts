import { DirectoryContent, ProjectState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

export const projectOpenedAction: ActionCreator = (
  path: string,
  projectName: string,
  hasVm: boolean,
  directoryContents: DirectoryContent
) => ({
  type: "PROJECT_OPENED",
  payload: { path, projectName, hasVm, directoryContents },
});
export const projectLoadingAction: ActionCreator = () => ({
  type: "PROJECT_LOADING",
});
export const closeProjectAction: ActionCreator = () => ({
  type: "PROJECT_CLOSED",
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
    case "PROJECT_OPENED":
      return {
        ...state,
        isLoading: false,
        path: payload.path,
        projectName: payload.projectName,
        hasVm: payload.hasVm,
        directoryContents: payload.directoryContents,
      };
    case "PROJECT_LOADING":
      return { ...state, isLoading: true };
    case "PROJECT_CLOSED":
      return { ...initialState };
    default:
      return state;
  }
}
