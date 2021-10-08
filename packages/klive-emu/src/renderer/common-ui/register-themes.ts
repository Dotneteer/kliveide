import { getThemeService } from "@extensibility/service-registry";
import { darkTheme } from "./themes/dark-theme";
import { lightTheme } from "./themes/light-theme";

export function registerThemes(isWindows: boolean): void {
  const themeService = getThemeService();
  themeService.isWindows = isWindows;
  themeService.registerTheme(darkTheme);
  themeService.registerTheme(lightTheme);
  themeService.setTheme("dark");
}
