import { useEffect, useState } from "react";
import { useTheme } from "@renderer/theming/ThemeProvider";

/**
 * Returns the `#themeRoot` element once the theme is available.
 * Shared by Dropdown and BankDropdown so that
 * Radix Select portals render inside the themed container.
 */
export function useThemeRoot(): HTMLElement | null {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (theme) {
      setRootElement(document.getElementById("themeRoot"));
    }
  }, [theme]);

  return rootElement;
}
