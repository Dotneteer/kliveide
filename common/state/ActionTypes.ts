/**
 * Available action types
 */
 export interface ActionTypes {
    UI_LOADED: null,
    IS_WINDOWS: null,
    SET_THEME: null,

    SHOW_TOOLBAR: null;
    SHOW_STATUSBAR: null;
    SHOW_TOOL_PANELS: null;
    SHOW_KEYBOARD: null;
    SHOW_FRAME_INFO: null;

    USE_EMU_VIEW: null;
    SHOW_SIDE_BAR: null;
    PRIMARY_BAR_ON_RIGHT: null;
    TOOLS_ON_TOP: null;
    MAXIMIZE_TOOLS: null;

    SET_ACTIVITY: null;
    SET_SIDEBAR_PANEL_EXPANDED: null;
    SET_SIDEBAR_PANELS_STATE: null;
    SET_SIDEBAR_PANEL_SIZE: null;

    ACTIVATE_DOC: null;
    CHANGE_DOC: null;
    CREATE_DOC: null;
    CLOSE_DOC: null;
    CLOSE_ALL_DOCS: null;

    SET_TOOLS: null;
    ACTIVATE_TOOL: null;
    CHANGE_TOOL_VISIBILITY: null;
    CHANGE_TOOL_STATE: null;
}
