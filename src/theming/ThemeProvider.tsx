import { useSelector } from "@/core/RendererProvider";
import { EMPTY_OBJECT } from "@/utils/stablerefs";
import React, { useCallback, useContext, useMemo, useState } from "react";
import classnames from "../utils/classnames";
import { darkTheme } from "./dark-theme";
import { iconLibrary } from "./icon-defs";
import { lightTheme } from "./light-theme";
import { ThemeInfo, ThemeManager } from "./theme";

// =====================================================================================================================
// Collect the supported themes

const availableThemes: Record<string, ThemeInfo> = {
  "light": {
    tone: "light",
    properties: lightTheme
  },
  "dark": {
    tone: "dark",
    properties: darkTheme
  }
}

// --- The default theme
const DEFAULT_THEME = "dark";

// =====================================================================================================================
/**
 * This object provides the React context of the theming, which we pass the root component, and thus all
 * nested apps and components may use it.
 */
const ThemeContext = React.createContext<ThemeManager | undefined>(undefined);

// =====================================================================================================================
/**
 * This React hook makes the current theme information available within any component logic using the hook.
 */
export function useTheme(): ThemeManager {
  return useContext(ThemeContext)!;
}

// =====================================================================================================================
/**
 * This type defines the value type of an overridden theme property.
 */
export type ThemeOverrideValue = string | Record<string, string>;

// =====================================================================================================================

type Props = {
  children?: React.ReactNode;
  themeId?: string;
}

/**
 * This React component injects the theming system's CSS variables into the DOM whenever the active theme or the 
 * theme-overriding properties change.
 * @param children Child elements
 * @param defaultTone The default theming tone
 * @constructor
 */
function ThemeProvider({
  children,
  themeId = DEFAULT_THEME
}: Props) {
  const [root, setRoot] = useState(
    () => document.getElementById("root") || document.body
  );
  const selectedTheme = useSelector(s => s.theme);
  const isWindows = useSelector(s => s.isWindows);

  const [styleProps, setStyleProps] = useState<Record<string, any>>(EMPTY_OBJECT);

  const rootRef = useCallback((rootElement: HTMLDivElement) => {
    setRoot(rootElement);
  }, []);

  const themeValue = useMemo(() => {
    const activeThemeInfo = availableThemes[selectedTheme];
    const mainFont = activeThemeInfo.properties[
      isWindows 
        ? "--shell-windows-font-family" 
        : "--shell-font-family"
      ];
    const monospaceFont = activeThemeInfo.properties[
      isWindows 
        ? "--shell-windows-monospace-font-family" 
        : "--shell-monospace-font-family"
    ];
    setStyleProps({
      ...activeThemeInfo.properties,
      "--main-font-family": mainFont,
      "--monospace-font": monospaceFont
    });
    return {
      theme: activeThemeInfo,
      root,
      getThemeProperty: (key: string) => activeThemeInfo.properties[key],
      getIcon: (key: string) => 
        iconLibrary.find(ic => ic.name === key) 
          ?? iconLibrary.find(ic => ic.name === "unknown")
    };
  }, [selectedTheme, root, isWindows]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <div
        ref={rootRef}
        className={classnames("baseRootComponent", `klive-${selectedTheme}`)}
        style={styleProps}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;