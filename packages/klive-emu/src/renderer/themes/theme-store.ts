import { IconDefs } from "./IconDefs";
import { IconInfo } from "./IconInfo";
import { ITheme } from "./theme-core";

/**
 * Represents the functionality of a theme store
 */
export interface ThemeStore {
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
   * Registers the specified icon information
   * @param iconInfo Icon information
   */
  registerIcon(iconInfo: IconInfo): void;
}

/**
 * Creates a store that handles the application's themes.
 */
function createStore(): ThemeStore {
  const themes: ITheme[] = [];
  let activeThemeName: string | null = null;
  let activeTheme: ITheme | null;
  const icons = new Map<string, IconInfo>();

  // --- Register default icons
  IconDefs.forEach((def) => icons.set(def.name, def));

  // --- Gets the theme by its name
  function getTheme(name: string) {
    const theme = themes.find((t) => t.name === name);
    if (!theme) {
      throw new Error(`Theme not found: '${name}'`);
    }
    return theme;
  }

  return {
    getActiveTheme: () => activeTheme,
    getProperty: (propName: string) =>
      (activeTheme.properties as any)[propName],
    setTheme(name: string) {
      activeThemeName = name;
      activeTheme = getTheme(name);
    },
    registerTheme: (theme: ITheme) => themes.push(theme),
    getIcon(name: string): IconInfo {
      const iconInfo = icons.get(name);
      if (!iconInfo) {
        throw new Error(`Icon not found: '${name}'`);
      }
      return iconInfo;
    },
    registerIcon: (iconInfo: IconInfo) => icons.set(iconInfo.name, iconInfo),
  };
}

/**
 * The singleton store instance
 */
export const themeStore = createStore();
