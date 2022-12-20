/**
 * Defines the properties of the themes that can be used with Klive.
 */
export type ThemeProperties = {
  // --- Global theme attributes
  "--bgcolor-splitter"?: string;
  
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

  // --- Sitebar
  "--bgcolor-sitebar"?: string;
  "--color-header"?: string;
  "--color-chevron"?: string;
  "--color-panel-header"?: string;
  "--color-panel-border"?: string;
  "--color-panel-focused"?: string;

  // --- Emulator area
  "--bgcolor-emuarea"?: string;

  // --- Document area
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
