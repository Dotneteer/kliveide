/**
 * Defines the properties of the themes that can be used with Klive.
 */
export type ThemeProperties = {
  "--color-bg-activitybar"?: string;
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
   * Specifies a function that sets the new theme.
   */
  readonly setTheme: (newTheme?: string) => void;

  /**
   * The HTML element that works as the root of the theme's scope.
   */
  readonly root: HTMLElement;
}
