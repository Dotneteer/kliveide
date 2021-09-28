import { IconInfo, ImageInfo, ITheme, IThemeService } from "@shared/services/IThemeService";
import { IconDefs } from "./IconDefs";
import { ImageIconDefs } from "./ImageDefs";
import { IThemeProperties } from "./IThemeProperties";

/**
 * Creates a store that handles the application's themes.
 */
export class ThemeService implements IThemeService {
  private readonly _themes: ITheme[] = [];
  private _activeTheme: ITheme | null;
  private _icons = new Map<string, IconInfo>();
  private _imageIcons = new Map<string, ImageInfo>();
  private _isWindows: boolean = false;

  constructor() {
    IconDefs.forEach((def) => this._icons.set(def.name, def));
    ImageIconDefs.forEach((def) => this._imageIcons.set(def.name, def));
  }

  /**
   * Gets the active theme
   */
  getActiveTheme(): ITheme {
    return this._activeTheme;
  }

  /**
   * Gets the value of the specified property
   * @param {string} propName Property name
   */
  getProperty(propName: string): string {
    return (this._activeTheme.properties as any)[propName];
  }

  /**
   * Sets the theme to the specified one
   * @param {string} name Active theme name
   */
  setTheme(name: string) {
    this._activeTheme = this.getTheme(name);
  }

  /**
   * Registers a new theme
   * @param {ITheme} theme New theme definition
   */
  registerTheme(theme: ITheme): void {
    this._themes.push(theme);
  }

  /**
   * Gets the specified icon information
   * @param name Icon name
   */
  getIcon(name: string): IconInfo {
    const iconInfo = this._icons.get(name);
    if (!iconInfo) {
      throw new Error(`Icon not found: '${name}'`);
    }
    return iconInfo;
  }

  /**
   * Gets the specified image icon information
   * @param name Icon name
   */
   getImageIcon(name: string): ImageInfo {
    const iconInfo = this._imageIcons.get(name);
    if (!iconInfo) {
      throw new Error(`Image icon not found: '${name}'`);
    }
    return iconInfo;
  }

  /**
   * Is Klive running on Windows?
   */
  get isWindows(): boolean {
    return this._isWindows;
  }
  set isWindows(value: boolean) {
    this._isWindows = value;
  }

  /**
   * Gets the current theme's style properties
   * @returns
   */
  getThemeStyle(): Record<string, string> {
    const theme = this._activeTheme;
    if (!theme) {
      return;
    }
    let themeStyle: Record<string, string> = {};
    for (const key in theme.properties) {
      themeStyle[key] = theme.properties[key as keyof IThemeProperties];
    }
    themeStyle["--main-font-family"] = this._isWindows
      ? theme.properties["--shell-windows-font-family"]
      : theme.properties["--shell-font-family"];
    return themeStyle;
  }

  // --- Gets the theme by its name
  private getTheme(name: string) {
    const theme = this._themes.find((t) => t.name === name);
    if (!theme) {
      throw new Error(`Theme not found: '${name}'`);
    }
    return theme;
  }
}
