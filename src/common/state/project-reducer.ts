//import path from "path";

import { getIsWindows } from "@renderer/os-utils";
import { Action } from "./Action";
import { IdeProject } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
export function projectReducer(state: IdeProject, { type, payload }: Action): IdeProject {
  switch (type) {
    case "OPEN_FOLDER":
      return {
        ...state,
        folderPath: payload?.file,
        isKliveProject: payload?.flag
      };

    case "CLOSE_FOLDER":
      return {
        projectFileVersion: 1,
        projectViewStateVersion: 1,
        buildFileVersion: 1,
        folderPath: null
      };

    case "SET_BUILD_ROOT":
      return {
        ...state,
        buildRoots: payload?.flag ? payload.files : []
      };

    case "INC_PROJECT_FILE_VERSION":
      return {
        ...state,
        projectFileVersion: state.projectFileVersion + 1
      };

    case "INC_PROJECT_VIEWSTATE_VERSION":
      return {
        ...state,
        projectViewStateVersion: state.projectViewStateVersion + 1
      };

    case "ADD_EXCLUDED_PROJECT_ITEMS": {
      const excludedItems = payload?.files?.map((p) => {
        p = p.trim();
        return p.replace(getIsWindows() ? "\\" : "/", "/");
      });
      return {
        ...state,
        excludedItems: (state.excludedItems?.concat(excludedItems!) ?? excludedItems)!.filter(
          (v, i, a) => a.indexOf(v) === i
        )
      };
    }

    case "SET_EXCLUDED_PROJECT_ITEMS":
      return {
        ...state,
        excludedItems: payload?.files
      };

    case "REFRESH_EXCLUDED_PROJECT_ITEMS":
      // This action is needed to force-refresh excluded project items,
      // e.g. trigger the project tree view update when global Klive
      // settings have been changed.
      return {
        ...state,
        excludedItems: state.excludedItems?.slice()
      };

    case "SET_PROJECT_BUILD_FILE":
      return {
        ...state,
        hasBuildFile: payload?.flag
      };

    case "INC_BUILD_FILE_VERSION":
      return {
        ...state,
        buildFileVersion: state.buildFileVersion + 1
      };

    default:
      return state;
  }
}
