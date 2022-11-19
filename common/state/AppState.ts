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
        showFrameInfo: true,
        showKeyboard: false,
        showSidebar: true
    }
}