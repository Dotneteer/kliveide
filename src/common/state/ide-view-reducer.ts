import { Action } from "./Action";
import { IdeView, SideBarPanelState } from "./AppState";

/**
 * This reducer is used to manage the IDE view properties
 */
export function ideViewReducer (
  state: IdeView,
  { type, payload }: Action
): IdeView {
  switch (type) {
    case "SET_ACTIVITY":
      return {
        ...state,
        activity: payload?.id
      };

    case "SET_SIDEBAR_PANEL_EXPANDED":
      return {
        ...state,
        sideBarPanels: {
          ...state.sideBarPanels,
          [payload!.id!]: {
            ...state.sideBarPanels![payload!.id!],
            expanded: payload?.flag
          } as SideBarPanelState
        }
      };

    case "SET_SIDEBAR_PANELS_STATE":
      return {
        ...state,
        sideBarPanels: {
          ...state.sideBarPanels,
          ...payload?.panelsState
        }
      };

    case "SET_SIDEBAR_PANEL_SIZE":
      return {
        ...state,
        sideBarPanels: {
          ...state.sideBarPanels,
          [payload!.id!]: {
            ...state.sideBarPanels![payload!.id!],
            size: payload?.size
          } as SideBarPanelState,
          [payload!.nextId!]: {
            ...state.sideBarPanels![payload!.nextId!],
            size: payload?.nextSize
          } as SideBarPanelState
        }
      };

    case "SET_TOOLS":
      return {
        ...state,
        tools: payload?.tools
      };

    case "SET_IDE_STATUS_MESSAGE":
      return {
        ...state,
        statusMessage: payload?.text,
        statusSuccess: payload?.flag
      };

    case "INC_TOOL_CMD_SEQ":
      return {
        ...state,
        toolCommandSeqNo: (state.toolCommandSeqNo ?? 0) + 1
      };

    case "DISPLAY_DIALOG":
      return {
        ...state,
        dialogToDisplay: payload?.index,
        dialogData: payload?.value
      };

    case "INC_DOC_HUB_SERVICE_VERSION": {
      const versions = { ...state.documentHubState };
      versions[payload!.index!] = (versions[payload!.index!] ?? 0) + 1;

      return {
        ...state,
        documentHubState: versions
      };
    }

    case "SET_VOLATILE_DOC_STATE": {
      return {
        ...state,
        volatileDocs: {
          ...state.volatileDocs,
          [payload!.id!]: payload!.flag
        } as any
      };
    }

    case "INC_EDITOR_VERSION": {
      return {
        ...state,
        editorVersion: (state.editorVersion ??  0) + 1
      }
    }

    case "INC_EXPLORER_VIEW_VERSION": {
      return {
        ...state,
        explorerViewVersion: (state.explorerViewVersion ?? 0) + 1
      }
    }
    
    default:
      return state;
  }
}
