/**
 * Defines the properties of the themes that can be used with Klive.
 */
export type ThemeProperties = {
  // --- Activity bar
  "--color-bg-activitybar"?: string;
  "--color-fg-activitybar"?: string;
  "--color-bg-activitybar-active"?: string;
  "--color-bg-activitybar-pointed"?: string;
  "--color-bg-activitybar-activepointed"?: string;
  "--color-fg-activitybar-active"?: string;

  // --- Tooltip
  "--border-tooltip"?: string;
  "--font-size-tooltip"?: string;
  "--color-bg-tooltip"?: string;
  "--color-fg-tooltip"?: string;
  "--radius-bg-tooltip"?: string;
  "--padding-tooltip"?: string;
  "--shadow-tooltip"?: string;

  // --- Toolbar
  "--color-bg-toolbar"?: string;

  // --- Statusbar
  "--color-bg-statusbar"?: string;

  // --- Sitebar
  "--color-bg-sitebar"?: string;

  // --- Emulator area
  "--color-bg-emuarea"?: string;

  // --- Document area
  "--color-bg-docarea"?: string;

  // --- Tool area
  "--color-bg-toolarea"?: string;
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
