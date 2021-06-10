import { IconDefs } from "./IconDefs";
import { IconInfo } from "./IconInfo";
import { ITheme } from "./theme-core";

/**
 * Creates a store that handles the application's themes.
 */
class ThemeService {
  private readonly _themes: ITheme[] = [];
  private _activeTheme: ITheme | null;
  private _icons = new Map<string, IconInfo>();

  constructor() {
    IconDefs.forEach((def) => this._icons.set(def.name, def));
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
   * Registers the specified icon information
   * @param iconInfo Icon information
   */
   registerIcon(iconInfo: IconInfo): void {
    this._icons.set(iconInfo.name, iconInfo);
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

/**
 * The singleton store instance
 */
export const themeService = new ThemeService();
