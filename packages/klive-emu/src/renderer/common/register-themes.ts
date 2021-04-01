import { darkTheme } from "../themes/dark-theme";
import { lightTheme } from "../themes/light-theme";
import { themeStore } from "../themes/theme-store";

export function registerThemes(): void {
  // --- Start with the dark theme
  themeStore.registerTheme(darkTheme);
  themeStore.registerTheme(lightTheme);
  themeStore.setTheme("dark");
}
