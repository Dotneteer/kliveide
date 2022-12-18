import { ThemeProperties } from "./theme";

export const darkTheme: ThemeProperties = {
    // --- Global theme attributes
    "--bgcolor-splitter": "#007acc",
  
    // --- Activity bar
    "--bgcolor-activitybar": "#383838",
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
    "--bgcolor-toolbar": "#202020",
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

    // --- Sitebar
    "--bgcolor-sitebar": "#282828",
    "--color-chevron": "#ffffff",
    "--color-panel-header": "#ffffff",
    "--color-panel-border": "#606060",
    "--color-panel-focused": "#007acc",

    // --- Emulator area
    "--bgcolor-emuarea": "#606060",

    // --- Document area
    "--bgcolor-docsheader": "#282828",
    "--color-doc-icon": "#ffffff",

    // --- Tool area
    "--bgcolor-toolarea": "#303030",
}