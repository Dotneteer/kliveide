import { ITheme } from "./theme-core";

/**
 * This constant value defines the propertief of the 'light' theme.
 */
export const lightTheme: ITheme = {
  name: "light",
  properties: {
    "--shell-font-family": "-apple-system, BlinkMacSystemFont, HelveticaNeue-Light, Ubuntu, Droid Sans, sans-serif",
    "--shell-windows-font-family": "Segoe WPC,Segoe UI, sans-serif",

    "--shell-canvas-background-color": "#EEEEEE",
    "--panel-separator-border": "silver",
    "--selected-border-color": "#007acc",
    "--selected-background-color": "#094771",
    "--selection-color": "#007acc",
    "--information-color": "#202020",
    "--hilited-color": "#007acc",
    "--console-font": "Consolas, \"Courier New\", monospace",

    "--button-background-color": "#808080",
    "--button-primary-background-color": "##007acc",
    "--button-focused-border-color": "#c0c0c0",

    "--toolbar-active-background-color": "#252525",
    "--toolbar-inactive-background-color": "#383838",
    "--toolbar-button-fill": "white",
    "--toolbar-button-disabled-fill": "#585858",
    "--toolbar-separator": "2px solid #686868",

    "--scrollbar-background-color": "#808080",

    "--statusbar-background-color": "#007acc",
    "--statusbar-foreground-color": "white",

    "--menu-active-background-color": "#505050",
    "--menu-text-color": "#ffffff",
    "--menu-disabled-text-color": "#AAAAAA",
    "--menu-pane-background-color": "#252526",
    "--menu-pane-shadow": "rgb(0, 0, 0) 0px 2px 4px",
    "--menu-selected-background": "#094771",
    "--menu-selected-text-color": "#ffffff",

    "--icon-default-size": "14",

    "--emulator-background-color": "#808080",
    "--keyboard-background-color": "#202020",

    "--key-background-color": "#808080",
    "--key-main-color": "white",
    "--key-keyboard-color": "white",
    "--key-symbol-color": "#c00000",
    "--key-above-color": "#00a000",
    "--key-below-color": "#d02000",
    "--key-highlight-color": "#0048c0",

    "--key-cz88-background-color": "#404040",
    "--key-cz88-stroke-color": "#a0a0a0",
    "--key-cz88-main-color": "white",
    "--key-cz88-highlight-color": "#0088e0",

    "--activity-bar-background-color": "#c8c8c8",
    "--activity-icon-color": "#cccccc",
    "--activity-current-icon-color": "#ffffff",
    "--activity-current-background-color": "#505050",

    "--sidebar-header-color": "#b7b7b7",
    "--sidebar-background-color": "#c0c0c0",
    "--sidebar-panel-header-color": "202020",

    "--splitter-hover-color": "#007acc",

    "--commandbar-background-color": "#252526",
    "--document-tab-background-color": "#252526",
    "--document-tab-color": "1e1e1e",
    "--document-tab-active-background-color": "1e1e1e",
    "--document-tab-active-color": "808080",

    "--command-button-pointed-background": "#3d3d3d",

    "--dropdown-text-color": "#ffffff",
    "--dropdown-backgound-color": "#3c3c3c",

    "--dialog-header-background": "#808080",

    "--console-ansiBlack": "#000000",
    "--console-ansiBlue": "#0451a5",
    "--console-ansiBrightBlack": "#666666",
    "--console-ansiBrightBlue": "#0451a5",
    "--console-ansiBrightCyan": "#0598bc",
    "--console-ansiBrightGreen": "#14CE14",
    "--console-ansiBrightMagenta": "#bc05bc",
    "--console-ansiBrightRed": "#cd3131",
    "--console-ansiBrightWhite": "#a5a5a5",
    "--console-ansiBrightYellow": "#b5ba00",
    "--console-ansiCyan": "#0598bc",
    "--console-ansiGreen": "#00BC00",
    "--console-ansiMagenta": "#bc05bc",
    "--console-ansiRed": "#cd3131",
    "--console-ansiWhite": "#e5e5e5",
    "--console-ansiYellow": "#949800",
  },
};
