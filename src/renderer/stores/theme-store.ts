import { writable } from "svelte/store";
import { ITheme } from "../themes/theme-core";
import { IconInfo } from "../themes/IconInfo";
import { IconDefs } from "../themes/IconDefs";

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
   * Updates the specified theme
   * @param {string} name Theme name
   * @param {{ [key: string]: string; }} properties Theme properties to merge into an existing theme
   */
  updateTheme(name: string, properties: { [key: string]: string }): void;

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

  /**
   * Subscribe to store changes
   * @param run Callback to process value changes
   * @param invalidator Callback to process cleanup
   */
  subscribe(
    run: (value: ITheme) => void,
    invalidator?: (value?: ITheme) => void
  ): () => void;
}

/**
 * Creates a store that handles the application's themes.
 */
function createStore(): ThemeStore {
  const themes: ITheme[] = [];
  let activeThemeName: string | null = null;
  let activeTheme: ITheme | null;
  const icons = new Map<string, IconInfo>();

  const { subscribe, set } = writable({} as ITheme);

  // --- Register default icons
  IconDefs.forEach(def => icons.set(def.name, def));

  // --- Gets the theme by its name
  function getTheme(name: string) {
    const theme = themes.find(t => t.name === name);
    if (!theme) {
      throw new Error(`Theme not found: '${name}'`);
    }
    return theme;
  }

  return {
    getActiveTheme: () => activeTheme,
    getProperty: (propName: string) => (activeTheme.properties as any)[propName],
    setTheme(name: string) {
      activeThemeName = name;
      activeTheme = getTheme(name);
      set(activeTheme);
    },
    registerTheme: (theme: ITheme) => themes.push(theme),
    updateTheme(name: string, properties: { [key: string]: string }): void {
      const theme = getTheme(name);
      theme.properties = {
        ...theme.properties,
        ...properties
      };
      if (name === activeThemeName) {
        set(theme);
      }
    },
    getIcon(name: string): IconInfo {
      const iconInfo = icons.get(name);
      if (!iconInfo) {
        throw new Error(`Icon not found: '${name}'`);
      }
      return iconInfo;
    },
    registerIcon: (iconInfo: IconInfo) => icons.set(iconInfo.name, iconInfo),
    subscribe
  };
}

/**
 * The singleton store instance
 */
export const themeStore = createStore();
