import { IThemeProperties } from "../../renderer/common-ui/themes/IThemeProperties";

/**
 * Describes a theme with its properties
 */
export interface ITheme {
  name: string;
  tone: "light" | "dark";
  properties: IThemeProperties;
}

/**
 * Lists the theme options, names the current theme name
 */
export interface IThemeOptions {
  themes: ITheme[];
  active: string;
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

/**
 * Represents information about an image in the registry.
 */
export type ImageInfo = {
  /**
   * The name (alias) of the icon.
   */
  name: string;

  /**
   * Image type
   */
  type: "png";

  /**
   * Base64 image data
   */
  data: string;
};

/**
 * Creates a store that handles the application's themes.
 */
export interface IThemeService {
  /**
   * Gets the active theme
   */
  getActiveTheme(): ITheme;

  /**
   * Gets the value of the specified property
   * @param {string} propName Property name
   */
  getProperty(propName: string): string;

  /**
   * Sets the theme to the specified one
   * @param {string} name Active theme name
   */
  setTheme(name: string): void;

  /**
   * Registers a new theme
   * @param {ITheme} theme New theme definition
   */
  registerTheme(theme: ITheme): void;

  /**
   * Gets the specified icon information
   * @param name Icon name
   */
  getIcon(name: string): IconInfo;

  /**
   * Gets the specified image icon information
   * @param name Icon name
   */
  getImageIcon(name: string): ImageInfo;

  /**
   * Is Klive running on Windows?
   */
  isWindows: boolean;

  /**
   * Gets the current theme's style properties
   * @returns
   */
  getThemeStyle(): Record<string, string>;
}
