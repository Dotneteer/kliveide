/**
 * Represents the state of the entire application
 */
 export type AppState = {
    uiLoaded?: boolean;
    isWindows?: boolean;
    emuViewOptions?: EmuViewOptions;
}

/**
 * Represents the state of the emulator view options
 */
export type EmuViewOptions = {
    showToolbar?: boolean;
    showStatusBar?: boolean;
    useEmuView?: boolean;
    primaryBarOnRight?: boolean;
    showToolPanels?: boolean;
    toolPanelsOnTop?: boolean;
    maximizeTools?: boolean;
    showFrameInfo?: boolean;
    showKeyboard?: boolean;
    showSidebar?: boolean;
}

/**
 * The initial application state
 */
export const initialAppState: AppState = {
    uiLoaded: false,
    isWindows: false,
    emuViewOptions:  {
        showToolbar: true,
        showStatusBar: true,
        useEmuView: false,
        primaryBarOnRight: false,
        showToolPanels: true,
        toolPanelsOnTop: false,
        maximizeTools: false,
        showFrameInfo: true,
        showKeyboard: false,
        showSidebar: true
    }
}