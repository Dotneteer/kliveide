import { IThemeProperties } from "./IThemeProperties";

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
