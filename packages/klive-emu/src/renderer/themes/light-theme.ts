import { ITheme } from "./theme-core";

/**
 * This constant value defines the propertief of the 'light' theme.
 */
export const lightTheme: ITheme = {
  name: "light",
  properties: {
    "--shell-canvas-background-color": "#EEEEEE",
    "--toolbar-active-background-color": "#252525",
    "--toolbar-inactive-background-color": "#383838",
    "--toolbar-button-fill": "white",
    "--toolbar-button-disabled-fill": "#585858",
    "--toolbar-separator": "2px solid #686868",

    "--statusbar-background-color": "#007acc",
    "--statusbar-foreground-color": "white",

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
    },
};
