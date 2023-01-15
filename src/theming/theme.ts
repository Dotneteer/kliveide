/**
 * Defines the properties of the themes that can be used with Klive.
 */
export type ThemeProperties = {
  // --- Font attributes
  "--shell-windows-font-family"?: string;
  "--shell-font-family"?: string;
  "--shell-windows-monospace-font-family"?: string;
  "--shell-monospace-font-family"?: string;

  // --- Global theme attributes
  "--bgcolor-splitter"?: string;
  "--color-command-icon"?: string;
  "--color-command-icon-disabled"?: string;
  "--bgcolor-scrollbar"?: string;
  "--bgcolor-scrollbar-thumb"?: string;
  "--bgcolor-attached-shadow"?: string;
  
  // --- Drowpdown
  "--bg-color-dropdown-input"?: string;
  "--color-dropdown-input"?: string;
  "--bg-color-dropdown-menu"?: string;
  "--color-dropdown-menu"?: string;
  "--bg-color-dropdown-menu-pointed"?: string;
  "--bg-color-dropdown-menu-selected"?: string;

  // --- Console colors
  "--console-ansi-black"?: string;
  "--console-ansi-blue"?: string;
  "--console-ansi-bright-black"?: string;
  "--console-ansi-bright-blue"?: string;
  "--console-ansi-bright-cyan"?: string;
  "--console-ansi-bright-green"?: string;
  "--console-ansi-bright-magenta"?: string;
  "--console-ansi-bright-red"?: string;
  "--console-ansi-bright-white"?: string;
  "--console-ansi-bright-yellow"?: string;
  "--console-ansi-cyan"?: string;
  "--console-ansi-green"?: string;
  "--console-ansi-magenta"?: string;
  "--console-ansi-red"?: string;
  "--console-ansi-white"?: string;
  "--console-ansi-yellow"?: string;
  "--console-default"?: string;

  // --- Label colors
  "--color-label"?: string;
  "--color-value"?: string;
  "--color-secondary-label"?: string;

  // --- Activity bar
  "--bgcolor-activitybar"?: string;
  "--color-activitybar"?: string;
  "--bgcolor-activitybar-active"?: string;
  "--bgcolor-activitybar-pointed"?: string;
  "--bgcolor-activitybar-activepointed"?: string;
  "--color-activitybar-active"?: string;

  // --- Tooltip
  "--border-tooltip"?: string;
  "--font-size-tooltip"?: string;
  "--bgcolor-tooltip"?: string;
  "--color-tooltip"?: string;
  "--radius-tooltip"?: string;
  "--padding-tooltip"?: string;
  "--shadow-tooltip"?: string;

  // --- Toolbar
  "--bgcolor-toolbar"?: string;
  "--bgcolor-keydown-toolbarbutton"?: string;
  "--bgcolor-toolbarbutton-disabled"?: string;
  "--color-toolbarbutton"?: string;
  "--color-toolbarbutton-green"?: string;
  "--color-toolbarbutton-blue"?: string;
  "--color-toolbarbutton-red"?: string;
  "--color-toolbar-separator"?: string;
  "--color-toolbarbutton-selected"?: string;

  // --- Statusbar
  "--bgcolor-statusbar"?: string;
  "--color-statusbar-label"?: string;
  "--color-statusbar-icon"?: string;

  // --- Sitebar
  "--bgcolor-sitebar"?: string;
  "--color-header"?: string;
  "--color-chevron"?: string;
  "--color-panel-header"?: string;
  "--color-panel-border"?: string;
  "--color-panel-focused"?: string;

  // --- Emulator area
  "--bgcolor-emuarea"?: string;
  "--bgcolor-emuoverlay"?: string;
  "--color-emuoverlay"?: string;

  // --- Document area
  "--bgcolor-docspanel"?: string;
  "--bgcolor-docsheader"?: string;
  "--color-doc-icon"?: string;
  "--color-doc-border"?: string;
  "--color-doc-activeText"?: string;
  "--color-doc-inactiveText"?: string;
  "--bgcolor-doc-activeTab"?: string;
  "--bgcolor-doc-inactiveTab"?: string;
  "--bgcolor-docscontainer"?: string;
  "--color-tabbutton-fill-inactive"?: string;
  "--color-tabbutton-fill-active"?: string;
  "--bgcolor-tabbutton-pointed"?: string;
  "--bgcolor-tabbutton-down"?: string;
  "--color-readonly-icon-active"?: string;
  "--color-readonly-icon-inactive"?: string;

  // --- Tool area
  "--bgcolor-toolarea"?: string;
  "--color-tooltab-active"?: string;
  "--color-tooltab-inactive"?: string;
  "--color-prompt"?: string;

  // --- Breakpoints panel
  "--color-breakpoint-enabled"?: string;
  "--color-breakpoint-disabled"?: string;
  "--color-breakpoint-current"?: string;
}

/**
 * Describes a theme with its properties
 */
export type ThemeInfo = {
  tone: ThemeTone;
  properties: ThemeProperties;
}

/**
 * Each theme can have a light or a dark tone.
 */
export const ThemeToneKeys = ["light", "dark"] as const;

/**
 * This type describes one the available theme tones.
 */
export type ThemeTone = typeof ThemeToneKeys[number];

/**
 * This type defines the contract to manage and change themes within an AppEngine application.
 */
export type ThemeManager = {
  /**
   * Gets the tone of the theme.
   */
  readonly theme: ThemeInfo;

  /**
   * Gets the value of the specified property
   * @param key Propery key
   * @returns Property value
   */
  readonly getThemeProperty: (key: string) => any;

  /**
   * Gets the information about the specified icon
   * @param key Icon ID
   * @returns Icon information
   */
  readonly getIcon: (key: string) => IconInfo | undefined;

  /**
   * The HTML element that works as the root of the theme's scope.
   */
  readonly root: HTMLElement;
}

/**
 * Represents information about an icon in the registry.
 */
export type IconInfo = {
  /**
   * The name (alias) of the icon.
   */
  name: string;

  /**
   * SVG path string.
   */
  path: string;

  /**
   * Icon width
   */
  width: number;

  /**
   * Icon height
   */
  height: number;

  /**
   * Optional fill value.
   */
  fill?: string;

  /**
   * The fill-rule value of the icon
   */
  "fill-rule"?: string;

  /**
   * The clip-rule value of the icon
   */
  "clip-rule"?: string;
};
