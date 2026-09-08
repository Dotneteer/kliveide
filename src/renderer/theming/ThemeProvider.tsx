import { useSelector } from "@renderer/core/RendererProvider";
import { EMPTY_OBJECT } from "@renderer/utils/stablerefs";
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState
} from "react";
import classnames from "classnames";
import { lookupIcon } from "./icon-registry";
import { imageLibrary } from "./image-defs";
import { ThemeInfo, ThemeManager } from "./theme";
import { DEFAULT_ACCENT, isAccentId, type AccentId } from "./tokens/palette";
import { semanticTokens } from "./tokens/semantic";
import { dimensionTokens, SPACE_BASE } from "./tokens/dimensions";
import { rowSizeTokens } from "./tokens/rowSizes";
import { componentAliases } from "./tokens/componentAliases";
import { staticTokens, toneTokens } from "./tokens/staticTokens";

// =====================================================================================================================
// Collect the supported themes

/**
 * A theme is now just a tone.
 *
 * `dark-theme.ts` and `light-theme.ts` used to carry 201 hand-authored values each — the light one a
 * copy of the dark one that had drifted (a missing token, an inverted one, overlays that ignored the
 * theme). Everything they held is now either derived from the ramps or aliased onto them, so all
 * that remains of a "theme" is which end of the ramp to read.
 */
const availableThemes: Record<string, ThemeInfo> = {
  light: { tone: "light", properties: staticTokens },
  dark: { tone: "dark", properties: staticTokens }
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
  const selectedAccent = useSelector((s) => s.accent);
  const isWindows = useSelector((s) => s.isWindows);
  const accentId: AccentId = isAccentId(selectedAccent) ? selectedAccent : DEFAULT_ACCENT;

  const [styleProps, setStyleProps] = useState<Record<string, any>>(EMPTY_OBJECT);

  const rootRef = useCallback((rootElement: HTMLDivElement) => {
    setRoot(rootElement);
  }, []);

  // --- Compute CSS variables separately so setStyleProps stays out of useMemo
  const themeVariables = useMemo(() => {
    const activeThemeInfo = availableThemes[selectedTheme];
    const mainFont =
      activeThemeInfo.properties[isWindows ? "--shell-windows-font-family" : "--shell-font-family"];
    const monospaceFont =
      activeThemeInfo.properties[
        isWindows ? "--shell-windows-monospace-font-family" : "--shell-monospace-font-family"
      ];
    const tone = activeThemeInfo.tone;
    return {
      // Order matters. The legacy theme object still supplies the values that have no semantic
      // equivalent — font stacks, the breakpoint data-URI images, the modal header gradient — so it
      // goes first and the token layers override the rest.
      ...activeThemeInfo.properties,
      ...toneTokens(tone),

      // L2 semantics and L3 dimensions.
      ...semanticTokens(tone, accentId),
      ...dimensionTokens(tone),
      ...rowSizeTokens(),
      "--space-base": SPACE_BASE,

      // L4: the ~200 names the stylesheets actually ask for, repointed onto the layers above. This
      // is what makes the whole app change palette without touching a single stylesheet.
      ...componentAliases,

      "--main-font-family": mainFont,
      "--monospace-font": monospaceFont
    };
  }, [selectedTheme, isWindows, accentId]);

  useEffect(() => {
    setStyleProps({ ...themeVariables, ...generateBaseSpacings(themeVariables) });
  }, [themeVariables]);

  /*
   * `getThemeProperty` below resolves an aliased token (e.g. `--color-switch-on: var(--accent-solid)`)
   * by reading `getComputedStyle(root)` - the only way to flatten an alias into a concrete colour for
   * the imperative consumers (react-switch, SVG `fill` attributes) that cannot use `var()` themselves.
   * That read happens during render, but `root`'s `style` attribute is only updated at *commit* -
   * after render. So the render that first reacts to a new accent/theme calls `getThemeProperty` for
   * DOM state that still reflects the *previous* accent, and returns the old colour; CSS-driven
   * consumers (a stylesheet's own `color: var(--accent-text)`) don't have this problem, since the
   * browser reflows every `var()` reference the instant the custom property changes on the DOM,
   * commit included. `getThemeProperty`'s stale read then sits there until *something else* happens
   * to re-render that consumer - which could be anywhere from immediate to, in practice, several
   * seconds later.
   *
   * `domCommitTick` closes that one-render gap: a `useLayoutEffect` runs synchronously right after
   * the commit that applied the new `styleProps` to `root`, so bumping this state re-renders
   * `themeValue`'s consumers before the browser paints - `getThemeProperty` calls made on that next
   * render see the already-updated DOM, and the correction is invisible instead of a multi-second lag.
   */
  const [domCommitTick, setDomCommitTick] = useState(0);
  useLayoutEffect(() => {
    setDomCommitTick((tick) => tick + 1);
  }, [styleProps]);

  const themeValue = useMemo(() => {
    const activeThemeInfo = availableThemes[selectedTheme];
    return {
      theme: activeThemeInfo,
      root,
      /**
       * Resolve a theme token to a final value.
       *
       * This reads the *computed* value off the theme root rather than looking the key up in the
       * theme object, for two reasons:
       *
       * - Since Phase 1 the component-level tokens are aliases (`var(--surface-chrome)`), so a raw
       *   lookup would return the alias text, and the ~30 imperative consumers would silently keep
       *   painting the pre-token palette while every stylesheet moved.
       * - Several of those consumers — the keyboard key SVGs above all — put the result into an SVG
       *   *presentation attribute* (`<rect fill={...}>`), where `var()` does not resolve at all.
       *   Only a concrete colour works there.
       *
       * Falls back to the merged style map before the root element is attached on first render.
       * `domCommitTick` is read only to force this memo (and so every consumer) to recompute the
       * render after `root`'s `style` attribute actually carries the new custom properties - see the
       * comment on the `useLayoutEffect` above.
       */
      getThemeProperty: (key: string) => {
        if (root) {
          const resolved = getComputedStyle(root).getPropertyValue(key).trim();
          if (resolved) return resolved;
        }
        return styleProps[key] ?? activeThemeInfo.properties[key];
      },
      getIcon: (key: string) => lookupIcon(key),
      getImage: (key: string) =>
        imageLibrary.find((im) => im.name === key) ??
        imageLibrary.find((im) => im.name === "file-code")
    };
  }, [selectedTheme, root, isWindows, styleProps, domCommitTick]);

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
