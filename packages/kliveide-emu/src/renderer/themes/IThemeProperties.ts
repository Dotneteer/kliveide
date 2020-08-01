/**
 * Defines the properties of the themes that can be used with SpentNetEls.
 */
export interface IThemeProperties {
  /**
   * The background color of the shell canvas.
   */
  "--shell-canvas-background-color": string;
  
  "--toolbar-active-background-color": string;
  "--toolbar-inactive-background-color": string;
  "--toolbar-button-fill": string;
  "--toolbar-button-disabled-fill": string;
  "--toolbar-separator": string;
  
  "--statusbar-background-color": string;

  "--emulator-background-color": string;

  "--keyboard-background-color": string;
  "--key-background-color": string;
  "--key-main-color": string;
  "--key-keyboard-color": string;
  "--key-symbol-color": string;
  "--key-above-color": string;
  "--key-below-color": string;
  "--key-highlight-color": string;
}
