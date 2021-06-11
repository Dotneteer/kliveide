/**
 * Defines the properties of the themes that can be used with SpentNetEls.
 */
export interface IThemeProperties {
  /**
   * The background color of the shell canvas.
   */
  "--shell-canvas-background-color": string;
  "--panel-separator-border": string;

  "--toolbar-active-background-color": string;
  "--toolbar-inactive-background-color": string;
  "--toolbar-button-fill": string;
  "--toolbar-button-disabled-fill": string;
  "--toolbar-separator": string;
  "--toolbar-selected-border-color": string;
  
  "--statusbar-background-color": string;
  "--statusbar-foreground-color": string;

  "--icon-default-size": string;

  "--emulator-background-color": string;

  "--keyboard-background-color": string;
  "--key-background-color": string;
  "--key-main-color": string;
  "--key-keyboard-color": string;
  "--key-symbol-color": string;
  "--key-above-color": string;
  "--key-below-color": string;
  "--key-highlight-color": string;

  "--key-cz88-background-color": string;
  "--key-cz88-stroke-color": string;
  "--key-cz88-main-color": string;
  "--key-cz88-highlight-color": string;

  "--activity-bar-background-color": string;
  "--activity-icon-color": string;
  "--activity-current-icon-color": string;
  "--activity-current-background-color": string;

  "--sidebar-background-color": string;
  "--sidebar-header-color": string;

  "--splitter-hover-color": string;

  "--commandbar-background-color": string;
  "--document-tab-background-color": string;
  "--document-tab-color": string;
  "--document-tab-active-background-color": string;
  "--document-tab-active-color": string;
}
