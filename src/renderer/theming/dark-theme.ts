import { ThemeProperties } from "./theme";

export const darkTheme: ThemeProperties = {
  // --- Font attributes
  "--shell-font-family":
    "-apple-system, BlinkMacSystemFont, Helvetica, Neue-Light, Ubuntu, Droid Sans, sans-serif",
  "--shell-windows-font-family": "Segoe WPC,Segoe UI, sans-serif",
  "--shell-windows-monospace-font-family": "Consolas, Courier New, monospace",
  "--shell-monospace-font-family": "Menlo, Monaco, Courier New, monospace",

  // --- Global theme attributes
  "--bgcolor-splitter": "#007acc",
  "--color-command-icon": "#c0c0c0",
  "--color-command-icon-disabled": "#606060",
  "--bgcolor-scrollbar": "transparent",
  "--bgcolor-scrollbar-thumb": "#808080",
  "--bgcolor-attached-shadow": "#000000",
  "--bgcolor-button-disabled": "#606060",
  "--color-button-disabled": "#aaaaaa",
  "--bgcolor-button": "#006daf",
  "--color-button": "#dddddd",
  "--bgcolor-button-pointed": "#0070c1",
  "--color-button-pointed": "#ffffff",
  "--color-button-focused": "#00a0ff",
  "--color-text-hilite": "#00a0ff",
  "--bgcolor-input": "#282828",
  "--color-input": "#ffffff",

  // --- Drowpdown
  "--bg-color-dropdown-input": "#505050",
  "--color-dropdown-input": "#ffffff",
  "--bg-color-dropdown-menu": "#505050",
  "--color-dropdown-menu": "#ffffff",
  "--bg-color-dropdown-menu-pointed": "#606060",
  "--bg-color-dropdown-menu-selected": "#007acc",

  // --- Context menu
  "--bgcolor-context-menu": "#282828",
  "--color-context-item": "#cccccc",
  "--color-context-item-disabled": "#606060",
  "--bgcolor-context-item-pointed": "#007acc",
  "--color-context-item-pointed": "#ffffff",
  "--color-context-separator": "#606060",

  // --- Modal 
  "--bgcolor-backdrop": "#00000080",
  "--bgcolor-modal": "#202020",
  "--color-modal": "#cccccc",
  "--border-modal": "1px solid #0076c9",
  "--radius-modal": "2px",
  "--bgcolor-modal-header": "#303030",
  "--color-modal-header": "#ffffff",
  "--bgcolor-modal-body": "#383838",
  "--color-modal-body": "#ffffff",
  "--bgcolor-modal-footer": "#303030",
  "--color-modal-footer": "#ffffff",

  // --- Console colors
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
  "--console-default": "#e5e5e5",

  // --- Label colors
  "--color-label": "#f89406",
  "--color-value": "#00afff",
  "--color-secondary-label": "#51c351",

  // --- Activity bar
  "--bgcolor-activitybar": "#2d2d2d",
  "--color-activitybar": "#a0a0a0",
  "--bgcolor-activitybar-pointed": "#484848",
  "--bgcolor-activitybar-active": "#007acc",
  "--bgcolor-activitybar-activepointed": "#008add",
  "--color-activitybar-active": "#ffffff",

  // --- Tooltip
  "--border-tooltip": "1px solid #808080",
  "--font-size-tooltip": "0.9em",
  "--bgcolor-tooltip": "#303030",
  "--color-tooltip": "#ffffff",
  "--radius-tooltip": "0.2em",
  "--padding-tooltip": "0.25em 0.5em",
  "--shadow-tooltip": "0 6px 12px 0 rgba(0, 0, 0, 0.2)",

  // --- Toolbar
  "--bgcolor-toolbar": "#383838",
  "--bgcolor-keydown-toolbarbutton": "#303030",
  "--bgcolor-toolbarbutton-disabled": "#606060",
  "--color-toolbarbutton": "white",
  "--color-toolbarbutton-green": "lightgreen",
  "--color-toolbarbutton-blue": "cyan",
  "--color-toolbarbutton-red": "red",
  "--color-toolbar-separator": "#686868",
  "--color-toolbarbutton-selected": "#007acc",

  // --- Statusbar
  "--bgcolor-statusbar": "#007acc",
  "--color-statusbar-label": "#ffffff",
  "--color-statusbar-icon": "#ffffff",

  // --- Sitebar
  "--bgcolor-sitebar": "#202020",
  "--color-header": "#ffffff",
  "--color-chevron": "#ffffff",
  "--color-chevron-selected": "#ffffff",
  "--color-panel-header": "#ffffff",
  "--color-panel-border": "#606060",
  "--color-panel-focused": "#007acc",

  // --- Emulator area
  "--bgcolor-emuarea": "#606060",
  "--bgcolor-emuoverlay": "#303030",
  "--color-emuoverlay": "lightgreen",

  // --- Keyboard
  "--bgcolor-keyboard": "#181818",
  "--bgcolor-key": "#808080",
  "--color-key-main": "#ffffff",
  "--color-key-symbol": "#c00000",
  "--color-key-above": "#00a000",
  "--color-key-below": "#d02000",
  "--color-key-highlight": "#0048c0",

  // --- Document area
  "--bgcolor-docspanel": "#181818",
  "--bgcolor-docsheader": "#282828",
  "--color-doc-icon": "#ffffff",
  "--color-doc-border": "#181818",
  "--color-doc-activeText": "#ffffff",
  "--color-doc-inactiveText": "#a0a0a0",
  "--bgcolor-doc-activeTab": "#181818",
  "--bgcolor-doc-inactiveTab": "#282828",
  "--bgcolor-docscontainer": "#181818",
  "--color-tabbutton-fill-inactive": "#a0a0a0",
  "--color-tabbutton-fill-active": "#ffffff",
  "--bgcolor-tabbutton-pointed": "#404040",
  "--bgcolor-tabbutton-down": "#505050",
  "--color-readonly-icon-active": "rgb(252, 165, 3)",
  "--color-readonly-icon-inactive": "rgb(204, 127, 3)",
  "--color-button-separator": "#606060",

  // --- Tool area
  "--bgcolor-toolarea": "#181818",
  "--color-tooltab-active": "#ffffff",
  "--color-tooltab-inactive": "#a0a0a0",
  "--color-prompt": "#23d18b",
  "--color-tool-border": "#505050",

  // --- Breakpoints panel
  "--color-breakpoint-enabled": "red",
  "--color-breakpoint-disabled": "#606060",
  "--color-breakpoint-current": "yellow",

  // --- Disassembly panel
  "--bgcolor-disass-even-row": "#282828",
  "--bgcolor-disass-hover": "#383838",

  // --- Memory panel
  "--bgcolor-memory-pointed": "#3b8eea",
  "--bgcolor-memory-pc-pointed": "#0DBC79",
  "--color-memory-pointed": "#ffffff",

  // --- Explorer
  "--color-explorer": "#cccccc",
  "--bgcolor-explorer-pointed": "#252829",
  "--fill-explorer-icon": "#29b8db",
  "--bgcolor-explorer-selected": "#303035",
  "--bgcolor-explorer-focused-selected": "#002952",
  "--color-explorer-selected": "#ffffff",
  "--color-explorer-focused-selected": "#ffffff",
  "--border-explorer-focused": "#0076c9",
};