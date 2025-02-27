import { useSelector } from "@renderer/core/RendererProvider";
import { EMPTY_OBJECT } from "@renderer/utils/stablerefs";
import React, { useCallback, useContext, useMemo, useState } from "react";
import classnames from "classnames";
import { darkTheme } from "./dark-theme";
import { iconLibrary } from "./icon-defs";
import { imageLibrary } from "./image-defs";
import { lightTheme } from "./light-theme";
import { ThemeInfo, ThemeManager } from "./theme";

// =====================================================================================================================
// Collect the supported themes

const availableThemes: Record<string, ThemeInfo> = {
  light: {
    tone: "light",
    properties: lightTheme
  },
  dark: {
    tone: "dark",
    properties: darkTheme
  }
};

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
};

/**
 * This React component injects the theming system's CSS variables into the DOM whenever the active theme or the
 * theme-overriding properties change.
 * @param children Child elements
 * @param defaultTone The default theming tone
 * @constructor
 */
function ThemeProvider({ children }: Props) {
  const [root, setRoot] = useState(() => document.getElementById("root") || document.body);
  const selectedTheme = useSelector((s) => s.theme);
  const isWindows = useSelector((s) => s.isWindows);

  const [styleProps, setStyleProps] = useState<Record<string, any>>(EMPTY_OBJECT);

  const rootRef = useCallback((rootElement: HTMLDivElement) => {
    setRoot(rootElement);
  }, []);

  const themeValue = useMemo(() => {
    // --- Collect theme variables from the current themes
    const activeThemeInfo = availableThemes[selectedTheme];

    // --- Set the main font and monospace font
    const mainFont =
      activeThemeInfo.properties[isWindows ? "--shell-windows-font-family" : "--shell-font-family"];
    const monospaceFont =
      activeThemeInfo.properties[
        isWindows ? "--shell-windows-monospace-font-family" : "--shell-monospace-font-family"
      ];

    // --- Set the initial theme variables
    const themeVariables: Record<string, any> = {
      ...activeThemeInfo.properties,
      "--main-font-family": mainFont,
      "--monospace-font": monospaceFont
    };

    setStyleProps({ ...themeVariables, ...generateBaseSpacings(themeVariables) });

    return {
      theme: activeThemeInfo,
      root,
      getThemeProperty: (key: string) => activeThemeInfo.properties[key],
      getIcon: (key: string) =>
        iconLibrary.find((ic) => ic.name === key) ??
        iconLibrary.find((ic) => ic.name === "unknown"),
      getImage: (key: string) =>
        imageLibrary.find((im) => im.name === key) ??
        imageLibrary.find((im) => im.name === "file-code")
    };
  }, [selectedTheme, root, isWindows]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <div
        id="themeRoot"
        ref={rootRef}
        className={classnames("baseRootComponent", `klive-${selectedTheme}`)}
        style={styleProps}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function generateBaseSpacings(theme: Record<string, string> | undefined) {
  if (!theme) {
    return {};
  }
  const base = theme["--space-base"];
  if (!base || typeof base !== "string") {
    return {};
  }

  let baseTrimmed = base.trim();
  if (baseTrimmed.startsWith(".")) {
    // --- If we have something like .5rem
    baseTrimmed = `0${baseTrimmed}`;
  }

  const baseNum = parseFloat(baseTrimmed);
  let baseUnit = baseTrimmed.replace(baseNum + "", "") || "px";

  // --- a) non-baseNum -> "0px"
  if (Number.isNaN(baseNum)) {
    return {};
  }

  const scale = [
    0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40,
    44, 48, 52, 56, 60, 64, 72, 80, 96
  ];
  const ret: Record<string, string> = {};

  scale.forEach((step) => {
    ret[`--space-${(step + "").replace(".", "_")}`] = `${step * baseNum}${baseUnit}`;
  });
  return ret;
}

export default ThemeProvider;
