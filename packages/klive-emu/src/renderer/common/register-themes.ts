import { darkTheme } from "../themes/dark-theme";
import { lightTheme } from "../themes/light-theme";
import { themeService } from "../themes/theme-service";

export function registerThemes(): void {
  // --- Start with the dark theme
  themeService.registerTheme(darkTheme);
  themeService.registerTheme(lightTheme);
  themeService.setTheme("dark");
}
