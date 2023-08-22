import * as path from "path";

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
        projectVersion: 0
      };

    case "SET_BUILD_ROOT":
      return {
        ...state,
        buildRoots: payload.flag ? [payload.file] : []
      };

    case "INC_PROJECT_VERSION":
      return {
        ...state,
        projectVersion: state.projectVersion + 1
      };

    case "ADD_EXCLUDED_PROJECT_ITEMS": {
      const excludedItems = payload.files.map(p => {
        p = p.trim();
        if (path.isAbsolute(p)) p = path.relative(state.folderPath, p);
        return p.replace(path.sep, "/");
      });
      return {
        ...state,
        excludedItems: (state.excludedItems?.concat(excludedItems) ?? excludedItems)
          .filter((v,i,a) => a.indexOf(v) === i)
      }
    }

    case "SET_EXCLUDED_PROJECT_ITEMS":
      return {
        ...state,
        excludedItems: payload.files
      }

    case "REFRESH_EXCLUDED_PROJECT_ITEMS":
      // This action is needed to force-refresh project tree,
      // e.g.: when global Klive setting have been changed.
      return {
        ...state,
        excludedItems: state.excludedItems?.slice()
      }

    default:
      return state;
  }
}
