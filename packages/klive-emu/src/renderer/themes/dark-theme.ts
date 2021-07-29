import { ITheme } from "./theme-core";

/**
 * This constant value defins the propertief of the 'dark' theme.
 */
export const darkTheme: ITheme = {
  name: "dark",
  properties: {
    "--shell-font-family":
      "-apple-system, BlinkMacSystemFont, HelveticaNeue-Light, Ubuntu, Droid Sans, sans-serif",
    "--shell-windows-font-family": "Segoe WPC,Segoe UI, sans-serif",

    "--shell-canvas-background-color": "#1E1E1E",
    "--panel-separator-border": "#8080805a",
    "--selected-border-color": "#007fd4",
    "--selected-background-color": "#094771",
    "--selection-color": "#007acc",
    "--information-color": "#c0c0c0",
    "--hilited-color": "#007acc",
    "--console-font": 'Consolas, "Courier New", monospace',
    
    "--list-hover-background-color": "#2a2d2e",
    "--list-selected-background-color": "#094771",

    "--button-background-color": "#606060",
    "--button-primary-background-color": "#007acc",
    "--button-focused-border-color": "#c0c0c0",

    "--toolbar-active-background-color": "#252525",
    "--toolbar-inactive-background-color": "#383838",
    "--toolbar-button-fill": "white",
    "--toolbar-button-disabled-fill": "#585858",
    "--toolbar-separator": "2px solid #686868",

    "--scrollbar-background-color": "#606060",

    "--statusbar-background-color": "#007acc",
    "--statusbar-foreground-color": "white",

    "--menu-active-background-color": "#505050",
    "--menu-text-color": "#ffffffc0",
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

    "--activity-bar-background-color": "#333333",
    "--activity-icon-color": "#ffffff66",
    "--activity-current-icon-color": "#ffffff",
    "--activity-current-background-color": "#505050",

    "--sidebar-header-color": "#b7b7b7",
    "--sidebar-background-color": "#252526",
    "--sidebar-panel-header-color": "white",

    "--splitter-hover-color": "#007acc",

    "--commandbar-background-color": "#252526",
    "--document-tab-background-color": "#2d2d2d",
    "--document-tab-color": "#ffffff80",
    "--document-tab-active-background-color": "#1e1e1e",
    "--document-tab-active-color": "#ffffff",

    "--command-button-pointed-background": "#3d3d3d",

    "--dropdown-text-color": "#ffffff",
    "--dropdown-backgound-color": "#3c3c3c",

    "--dialog-header-background": "#383838",

    "--console-ansi-black": "#000000",
    "--console-ansi-blue": "#2472c8",
    "--console-ansi-bright-black": "#666666",
    "--console-ansi-bright-blue": "#3b8eea",
    "--console-ansi-bright-cyan": "#29b8db",
    "--console-ansi-bright-green": "#23d18b",
    "--console-ansi-bright-magenta": "#d670d6",
    "--console-ansi-bright-red": "#f14c4c",
    "--console-ansi-bright-white": "#e5e5e5",
    "--console-ansi-bright-yellow": "#f5f543",
    "--console-ansi-cyan": "#11a8cd",
    "--console-ansi-green": "#0DBC79",
    "--console-ansi-magenta": "#bc3fbc",
    "--console-ansi-red": "#cd3131",
    "--console-ansi-white": "#e5e5e5",
    "--console-ansi-yellow": "#e5e510",

    "--interactive-input-color": "#23d18b",

    "--explorer-folder-color": "#c09553",
    "--explorer-file-color": "#007acc",
  },
};
