import { darkTheme } from "./themes/dark-theme";
import { lightTheme } from "./themes/light-theme";
import { getThemeService } from "@abstractions/service-helpers";

export function registerThemes(isWindows: boolean): void {
  const themeService = getThemeService();
  themeService.isWindows = isWindows;
  themeService.registerTheme(darkTheme);
  themeService.registerTheme(lightTheme);
  themeService.setTheme("dark");
}
