import { Action } from "./Action";
import { IdeProject } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
export function projectReducer (
  state: IdeProject,
  { type, payload }: Action
): IdeProject {
  switch (type) {
    case "OPEN_FOLDER":
      return {
        ...state,
        folderPath: payload.file,
        isKliveProject: payload.flag
      };

    case "CLOSE_FOLDER":
      return {
        ...state,
        folderPath: undefined,
        isKliveProject: false
      };

    case "SET_BUILD_ROOT":
      return {
        ...state,
        buildRoots: payload.flag ? [payload.file] : []
      };

    default:
      return state;
  }
}
