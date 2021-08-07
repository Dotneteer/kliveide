import { darkTheme } from "./themes/dark-theme";
import { lightTheme } from "./themes/light-theme";
import { themeService } from "./themes/theme-service";

export function registerThemes(isWindows: boolean): void {
  themeService.isWindows = isWindows;
  themeService.registerTheme(darkTheme);
  themeService.registerTheme(lightTheme);
  themeService.setTheme("dark");
}
