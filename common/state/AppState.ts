import { DocumentState } from "@/ide/abstractions";

/**
 * Represents the state of the entire application
 */
 export type AppState = {
    uiLoaded?: boolean;
    isWindows?: boolean;
    theme?: string;
    emuViewOptions?: EmuViewOptions;
    ideView?: IdeView;
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

export type IdeView = {
    activity?: string;
    sideBarPanels?: Record<string, SideBarPanelState>;
    openDocuments?: DocumentState[];
    activeDocumentIndex?: number;
}

/**
 * The state of a particular site bar panel
 */
export type SideBarPanelState = {
    expanded: boolean;
    size: number;
}

/**
 * The initial application state
 */
export const initialAppState: AppState = {
    uiLoaded: false,
    isWindows: false,
    theme: "dark",
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
    },
    ideView: {
        sideBarPanels: {},
        openDocuments: [],
        activeDocumentIndex: -1,
    }
}