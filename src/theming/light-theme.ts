import { ThemeProperties } from "./theme";

export const lightTheme: ThemeProperties = {
  // --- Font attributes
  "--shell-font-family":
    "-apple-system, BlinkMacSystemFont, Helvetica, Neue-Light, Ubuntu, Droid Sans, sans-serif",
  "--shell-windows-font-family": "Segoe WPC,Segoe UI, sans-serif",
  "--shell-windows-monospace-font-family": "Consolas, Courier New, monospace",
  "--shell-monospace-font-family": "Menlo, Monaco, Courier New, monospace",

  // --- Global theme attributes
  "--bgcolor-splitter": "#61a4d0",
  "--color-command-icon": "#303030",
  "--bgcolor-scrollbar": "transparent",
  "--bgcolor-scrollbar-thumb": "#808080",

  // --- Drowpdown
  "--bg-color-dropdown-input": "#a0a0a0",
  "--color-dropdown-input": "#000000",
  "--bg-color-dropdown-menu": "#a0a0a0",
  "--color-dropdown-menu": "#000000",
  "--bg-color-dropdown-menu-pointed": "#909090",
  "--bg-color-dropdown-menu-selected": "#007acc",

  // --- Console colors
  "--console-ansi-black": "#000000",
  "--console-ansi-blue": "#0451a5",
  "--console-ansi-bright-black": "#666666",
  "--console-ansi-bright-blue": "#0451a5",
  "--console-ansi-bright-cyan": "#0598bc",
  "--console-ansi-bright-green": "#14CE14",
  "--console-ansi-bright-magenta": "#bc05bc",
  "--console-ansi-bright-red": "#cd3131",
  "--console-ansi-bright-white": "#a5a5a5",
  "--console-ansi-bright-yellow": "#b5ba00",
  "--console-ansi-cyan": "#0598bc",
  "--console-ansi-green": "#00BC00",
  "--console-ansi-magenta": "#bc05bc",
  "--console-ansi-red": "#cd3131",
  "--console-ansi-white": "#e5e5e5",
  "--console-ansi-yellow": "#949800",

  // --- Label colors
  "--color-label": "#f89406",
  "--color-value": "#00afff",
  "--color-secondary-label": "#51c351",

  // --- Activity bar
  "--bgcolor-activitybar": "#d0d0d0",
  "--color-activitybar": "#404040",
  "--bgcolor-activitybar-pointed": "#a0a0a0",
  "--bgcolor-activitybar-active": "#61a4d0",
  "--bgcolor-activitybar-activepointed": "#71b4e0",
  "--color-activitybar-active": "#000000",

  // --- Tooltip
  "--border-tooltip": "1px solid #808080",
  "--font-size-tooltip": "0.9em",
  "--bgcolor-tooltip": "#c0c0c0",
  "--color-tooltip": "#000000",
  "--radius-tooltip": "0.2em",
  "--padding-tooltip": "0.25em 0.5em",
  "--shadow-tooltip": "0 6px 12px 0 rgba(0, 0, 0, 0.2)",

  // --- Toolbar
  "--bgcolor-toolbar": "#d8d8d8",
  "--bgcolor-keydown-toolbarbutton": "#d0d0d0",
  "--bgcolor-toolbarbutton-disabled": "#a0a0a0",
  "--color-toolbarbutton": "#000000",
  "--color-toolbarbutton-green": "darkgreen",
  "--color-toolbarbutton-blue": "#007acc",
  "--color-toolbarbutton-red": "darkred",
  "--color-toolbar-separator": "#b0b0b0",
  "--color-toolbarbutton-selected": "#61a4d0",

  // --- Statusbar
  "--bgcolor-statusbar": "#61a4d0",
  "--color-statusbar-label": "#000000",
  "--color-statusbar-icon": "#000000",

  // --- Sitebar
  "--bgcolor-sitebar": "#d8d8d8",
  "--color-header": "#000000",
  "--color-chevron": "#000000",
  "--color-panel-header": "#000000",
  "--color-panel-focused": "#61a4d0",

  // --- Emulator area
  "--bgcolor-emuarea": "#909090",
  "--bgcolor-emuoverlay": "#303030",
  "--color-emuoverlay": "lightgreen",

  // --- Document area
  "--bgcolor-docsheader": "#d8d8d8",
  "--color-doc-icon": "#000000",
  "--color-doc-border": "#e0e0e0",
  "--color-doc-activeText": "#000000",
  "--color-doc-inactiveText": "#404040",
  "--bgcolor-doc-activeTab": "#e0e0e0",
  "--bgcolor-doc-inactiveTab": "#c8c8c8",
  "--bgcolor-docscontainer": "#e0e0e0",
  "--color-tabbutton-fill-inactive": "#505050",
  "--color-tabbutton-fill-active": "#000000",
  "--bgcolor-tabbutton-pointed": "#c0c0c0",
  "--bgcolor-tabbutton-down": "#b0b0b0",
  "--color-readonly-icon-active": "rgb(252, 165, 3)",
  "--color-readonly-icon-inactive": "rgb(204, 127, 3)",

  // --- Tool area
  "--bgcolor-toolarea": "#d0d0d0",
  "--color-tooltab-active": "#000000",
  "--color-tooltab-inactive": "#404040",
  "--color-prompt": "#14CE14",

  // --- Breakpoints panel
  "--color-breakpoint-enabled": "red",
  "--color-breakpoint-disabled": "#a0a0a0",
  "--color-breakpoint-current": "yellow",
};
