import { EMPTY_OBJECT } from "@/utils/stablerefs";
import React, { useCallback, useContext, useMemo, useState } from "react";
import classnames from "../utils/classnames";
import { darkTheme } from "./dark-theme";
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
const DEFAULT_THEME = "light";

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
  const [activeTheme, setActiveTheme] = useState<string>(themeId);
  const [styleProps, setStyleProps] = useState<Record<string, any>>(EMPTY_OBJECT);

  const rootRef = useCallback((rootElement: HTMLDivElement) => {
    setRoot(rootElement);
  }, []);

  const setter = useCallback(
    (newTheme?: string) => {
      setActiveTheme(newTheme);
      const style = availableThemes[newTheme]
      setStyleProps({...style});
    },
    [themeId]
  );

  const themeValue = useMemo(() => {
    const activeThemeInfo = availableThemes[activeTheme];
    setStyleProps({...activeThemeInfo.properties});
    console.log({...activeThemeInfo.properties});
    return {
      theme: activeThemeInfo,
      setTheme: setter,
      root,
    };
  }, [activeTheme, root, setter]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <div
        ref={rootRef}
        className={classnames("baseRootComponent", `klive-${activeTheme}`)}
        style={styleProps}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;
