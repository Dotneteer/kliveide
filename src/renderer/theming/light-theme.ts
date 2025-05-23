import { ThemeProperties } from "./theme";

export const lightTheme: ThemeProperties = {
  // --- General
  "--space-base": "0.25em",
  
  // --- Font attributes
  "--shell-font-family":
    "-apple-system, BlinkMacSystemFont, Helvetica, Neue-Light, Ubuntu, Droid Sans, sans-serif",
  "--shell-windows-font-family": "Segoe WPC,Segoe UI, sans-serif",
  "--shell-windows-monospace-font-family": "Consolas, Courier New, monospace",
  "--shell-monospace-font-family": "Menlo, Monaco, Courier New, monospace",

  // --- Global theme attributes
  "--color-text": "#202020",
  "--bgcolor-splitter": "#61a4d0",
  "--color-command-icon": "#303030",
  "--color-command-icon-disabled": "#a0a0a0",
  "--bgcolor-scrollbar": "transparent",
  "--bgcolor-scrollbar-thumb": "#808080",
  "--bgcolor-attached-shadow": "#bbbbbb",
  "--bgcolor-button-disabled": "#808080",
  "--color-button-disabled": "#cccccc",
  "--bgcolor-button": "#006daf",
  "--color-button": "#dddddd",
  "--bgcolor-button-pointed": "#0070c1",
  "--color-button-pointed": "#ffffff",
  "--color-button-focused": "#00a0ff",
  "--color-text-hilite": "#00a0ff",
  "--bgcolor-input": "#d8d8d8",
  "--color-input": "#414141",
  "--bgcolor-item-hover": "#b8b8b8",

  // --- Drowpdown
  "--bg-color-dropdown-input": "#c0c0c0",
  "--color-dropdown-input": "#000000",
  "--bg-color-dropdown-menu": "#c0c0c0",
  "--color-dropdown-menu": "#000000",
  "--bg-color-dropdown-menu-pointed": "#a0a0a0",
  "--bg-color-dropdown-menu-selected": "#71b4e0",
  "--border-color-dropdown-menu": "#71b4e0",

  // --- Checkbox
  "--bgcolor-checkbox": "#d8d8d8",
  "--color-checkbox": "#00a0ff",
  "--color-checkbox-border-normal": "#202020",
  "--color-checkbox-border-focused": "#00a0ff",

  // --- Context menu
  "--bgcolor-context-menu": "#d8d8d8",
  "--color-context-item": "#414141",
  "--color-context-item-dangerous": "#cd3131",
  "--color-context-item-disabled": "#a0a0a0",
  "--bgcolor-context-item-pointed": "#007acc",
  "--color-context-item-pointed": "#ffffff",
  "--color-context-separator": "#606060",

  // --- Modal
  "--bgcolor-backdrop": "#ffffff80",
  "--bgcolor-modal": "#e8e8e8",
  "--border-modal": "1px solid #0076c9",
  "--radius-modal": "8px",
  "--bgcolor-modal-header": "#d0d0d0",
  "--color-modal-header": "#000000",
  "--bgcolor-modal-body": "#f0f0f0",
  "--color-modal-body": "#414141",
  "--bgcolor-modal-footer": "#d0d0d0",
  "--color-modal-footer": "#000000",

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
  "--console-lineNo": "#808080",

  // --- Label colors
  "--color-label": "#b85406",
  "--color-value": "#003f7f",
  "--color-secondary-label": "#116321",

  // --- Activity bar
  "--bgcolor-activitybar": "#d0d0d0",
  "--color-activitybar": "#404040",
  "--bgcolor-activitybar-pointed": "#a0a0a0",
  "--bgcolor-activitybar-active": "#61a4d0",
  "--bgcolor-activitybar-activepointed": "#71b4e0",
  "--color-activitybar-active": "#000000",

  // --- Tooltip
  "--border-tooltip": "1px solid #007acc",
  "--font-size-tooltip": "0.9em",
  "--bgcolor-tooltip": "#c0c0c0",
  "--color-tooltip": "#000000",
  "--radius-tooltip": "0.2em",
  "--padding-tooltip": "0.25em 0.5em",
  "--shadow-tooltip": "0 6px 12px 0 rgba(0, 0, 0, 0.2)",

  // --- Toolbar
  "--bgcolor-toolbar": "#d8d8d8",
  "--bgcolor-keydown-toolbarbutton": "#d0d0d0",
  "--bgcolor-toolbarbutton-disabled": "#303030",
  "--color-toolbarbutton": "#000000",
  "--color-toolbarbutton-green": "darkgreen",
  "--color-toolbarbutton-blue": "#007acc",
  "--color-toolbarbutton-orange": "brown",
  "--color-toolbarbutton-red": "darkred",
  "--color-toolbar-separator": "#b0b0b0",
  "--color-toolbarbutton-selected": "#61a4d0",
  "--bgcolor-toolbarbutton-hover": "#00000010",

  // --- Statusbar
  "--bgcolor-statusbar": "#61a4d0",
  "--bgcolor-errorLabel": "orange",
  "--color-statusbar-label": "#000000",
  "--color-statusbar-icon": "#000000",

  // --- Sitebar
  "--bgcolor-sitebar": "#f1f1f1",
  "--color-header": "#000000",
  "--color-chevron": "#000000",
  "--color-chevron-selected": "#ffffff",
  "--color-panel-border": "#a0a0a0",
  "--color-panel-header": "#000000",
  "--color-panel-focused": "#61a4d0",

  // --- Emulator area
  "--bgcolor-emuarea": "#909090",
  "--bgcolor-emuoverlay": "#303030",
  "--color-emuoverlay": "lightgreen",
  "--bgcolor-display": "#c0c0c0",
  "--color-display": "#202020",
  "--color-display-hilite": "#2144b0",

  // --- Keyboard
  "--bgcolor-keyboard": "#202020",
  "--bgcolor-key": "#707070",
  "--color-key48-main": "#e0e0e0",
  "--color-key128-main": "#c0c0c0",
  "--bgcolor-hilited48": "orangered",
  "--bgcolor-hilited128": "orangered",
  "--color-key-symbol": "#c00000",
  "--color-key-above": "#00a000",
  "--color-key-below": "#d02000",
  "--color-key48-highlight": "#0048c0",
  "--color-key128-highlight": "#0068e0",
  "--bgcolor-key128": "#1c1c1c",
  "--bgcolor-key128-raise": "#303030",
  "--bgcolor-keyz88": "#404040",
  "--color-keyz88": "#a0a0a0",
  "--color-keyz88-main": "white",
  "--color-keyz88-highlight": "#0088e0",
  "--bgcolor-hilitedz88": "orangered",

  // --- Document area
  "--bgcolor-docspanel": "#e8e8e8",
  "--bgcolor-docsheader": "#d8d8d8",
  "--color-doc-icon": "#000000",
  "--color-doc-border": "#e8e8e8",
  "--color-doc-activeText": "#000000",
  "--color-doc-inactiveText": "#404040",
  "--btopcolor-doc-activeTab": "#007acc",
  "--bgcolor-doc-activeTab": "#ffffff",
  "--bgcolor-doc-inactiveTab": "#f0f0f0",
  "--bgcolor-docscontainer": "#ffffff",
  "--color-tabbutton-fill-inactive": "#505050",
  "--color-tabbutton-fill-active": "#000000",
  "--bgcolor-tabbutton-pointed": "#c0c0c0",
  "--bgcolor-tabbutton-down": "#b0b0b0",
  "--color-readonly-icon-active": "rgb(252, 165, 3)",
  "--color-readonly-icon-inactive": "rgb(204, 127, 3)",
  "--color-button-separator": "#a0a0a0",
  "--bgcolor-expandable": "#d0d0d0",

  // --- Tool area
  "--bgcolor-toolarea": "#e8e8e8",
  "--btopcolor-tooltab-activeTab": "#007acc",
  "--color-tooltab-active": "#000000",
  "--color-tooltab-inactive": "#404040",
  "--color-prompt": "#00BC00",
  "--color-tool-border": "#a0a0a0",

  // --- Breakpoints panel
  "--color-breakpoint-code": "red",
  "--color-breakpoint-binary": "#0598bc",
  "--color-breakpoint-mixed": "#bc05bc",
  "--color-breakpoint-disabled": "#a0a0a0",
  "--color-breakpoint-current": "darkorange",
  "--image-breakpoint-current": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="orange"><path d="M21.75 10.725l-6.39-7.11-1.11-0.83H6.375L4.5 4.875v14.22l1.875 1.875h7.59l1.395-0.63 6.39-7.11v-1.065zm-7.785 8.37H6.375V4.875h7.59l6.39 7.11-6.39 7.11z"/></svg>')`,
  "--image-breakpoint-current-existing": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="orange"><circle cx="12" cy="12" r="4" fill="red"/><path d="M21.75 10.725l-6.39-7.11-1.11-0.83H6.375L4.5 4.875v14.22l1.875 1.875h7.59l1.395-0.63 6.39-7.11v-1.065zm-7.785 8.37H6.375V4.875h7.59l6.39 7.11-6.39 7.11z"/></svg>')`,
  "--image-breakpoint-current-existing-bin": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="orange"><circle cx="12" cy="12" r="4" fill="rgb(5, 152, 188)"/><path d="M21.75 10.725l-6.39-7.11-1.11-0.83H6.375L4.5 4.875v14.22l1.875 1.875h7.59l1.395-0.63 6.39-7.11v-1.065zm-7.785 8.37H6.375V4.875h7.59l6.39 7.11-6.39 7.11z"/></svg>')`,
  "--image-breakpoint-macro": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="orange"><path d="M1.5 2l-.5.5v11l.5.5H4v-1H2V3h2V2H1.5zm13 12l.5-.5v-11l-.5-.5H12v1h2v10h-2v1h2.5z"/></svg>')`,
  "--image-breakpoint-macro-existing": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="orange"><circle cx="8" cy="8" r="4" fill="red"/><path d="M1.5 2l-.5.5v11l.5.5H4v-1H2V3h2V2H1.5zm13 12l.5-.5v-11l-.5-.5H12v1h2v10h-2v1h2.5z"/></svg>')`,
  "--image-breakpoint-macro-existing-bin": `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="orange"><circle cx="8" cy="8" r="4" fill="rgb(41, 184, 219)"/><path d="M1.5 2l-.5.5v11l.5.5H4v-1H2V3h2V2H1.5zm13 12l.5-.5v-11l-.5-.5H12v1h2v10h-2v1h2.5z"/></svg>')`,

  // --- Disassembly panel
  "--bgcolor-disass-even-row": "#f0f0f0",
  "--bgcolor-disass-hover": "#e0e0e0",

  // --- Memory panel
  "--bgcolor-memory-hover": "#a0a0a0",
  "--bgcolor-memory-pointed": "#0451a5",
  "--bgcolor-memory-pc-pointed": "#00BC00",
  "--color-memory-pointed": "#ffffff",

  // --- Explorer
  "--color-explorer": "#414141",
  "--bgcolor-explorer-pointed": "#e4e4e4",
  "--fill-explorer-icon": "#29b8db",
  "--bgcolor-explorer-selected": "#dfe2ee",
  "--bgcolor-explorer-focused-selected": "#0057b3",
  "--color-explorer-selected": "#616161",
  "--color-explorer-focused-selected": "#ffffff",
  "--border-explorer-focused": "#0076c9",

  // --- Debugging
  "--bgcolor-debug-active-bp": "#c0800032",
  "--bgcolor-debug-macro-bp": "#80800032",
  "--color-debug-unreachable-bp": "brown",

  // --- Editors
  "--bgcolor-editors": "#d8d8d8",

  // --- Sprite editor
  "--bgcolor-sprite-editor": "#c0c0c0",
  "--color-ruler-sprite-editor": "#606060",
  "--color-dash-sprite-editor": "#e0e0e0",
  "--color-pos-sprite-editor": "#00a0ff",

  // --- Switch
  "--color-switch-on": "#007acc",
  "--bgcolor-switch-on": "#c0c0c0",
  "--color-switch-off": "#808080",
  "--bgcolor-switch-off": "#c0c0c0"
};
