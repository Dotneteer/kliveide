import { Action } from "./Action";
import { IdeViewOptions } from "./AppState";

/**
 * This reducer is used to manage the emulator view option properties
 */
export function ideViewOptionsReducer (
  state: IdeViewOptions,
  { type, payload }: Action
): IdeViewOptions {
  switch (type) {
    case "SHOW_IDE_TOOLBAR":
      return { ...state, showToolbar: payload?.flag };
    case "SHOW_IDE_STATUSBAR":
      return { ...state, showStatusBar: payload?.flag };
    case "SHOW_SIDE_BAR":
      return { ...state, showSidebar: payload?.flag };
    case "PRIMARY_BAR_ON_RIGHT":
      return { ...state, primaryBarOnRight: payload?.flag };
    case "SHOW_TOOL_PANELS":
      return { ...state, showToolPanels: payload?.flag };
    case "TOOLS_ON_TOP":
      return { ...state, toolPanelsOnTop: payload?.flag };
    case "MAXIMIZE_TOOLS":
      return { ...state, maximizeTools: payload?.flag };
    case "SHOW_FRAME_INFO":
      return { ...state, showFrameInfo: payload?.flag };
    case "SET_IDE_FONT_SIZE":
      return { ...state, editorFontSize: payload?.numValue };
    case "SYNC_SOURCE_BREAKPOINTS":
      return { ...state, syncSourceBreakpoints: payload?.flag };
    default:
      return state;
  }
}
