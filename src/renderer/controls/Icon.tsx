import { useTheme } from "@renderer/theming/ThemeProvider";
import { CSSProperties, memo } from "react";
import type { SVGProps } from "react";

type Props = {
  iconName: string;
  xclass?: string;
  width?: number;
  height?: number;
  fill?: string;
  rotate?: number;
  style?: CSSProperties;
  opacity?: number;
};

/**
 * Represents an SVG icon from the stock
 */
export const Icon = memo(({
  iconName,
  xclass,
  width = 24,
  height = 24,
  fill,
  rotate,
  style,
  opacity = 1.0
}: Props) => {
  const theme = useTheme();

  if (iconName) {
    const iconInfo = theme.getIcon(iconName);
    const fillValue =
      fill === null || fill === undefined
        ? iconInfo.fill ?? "white"
        : fill.startsWith("--")
        ? theme.getThemeProperty(fill)
        : fill;
    const styleValue: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      fill: `${fillValue}`,
      fillOpacity: opacity,
      transform: `rotate(${rotate ?? 0}deg)`,
      flexShrink: 0,
      flexGrow: 0
    };

    if (iconName?.startsWith("@")) {
      const imageInfo = theme.getImage(
        iconName.substring(1) + (theme.theme.tone === "light" ? "-light" : "")
      );
      return (
        <img
          className={xclass}
          src={`data:image/${imageInfo.type};base64,${imageInfo.data}`}
          style={{ ...styleValue, ...style, opacity }}
        />
      );
    }

    // --- Icons loaded from assets/icons keep arbitrary inner markup, which is
    // --- what multi-element, stroke-based sets (Lucide) need.
    if (iconInfo.kind === "markup") {
      const { paint } = iconInfo;
      return (
        <svg
          className={xclass}
          xmlns='http://www.w3.org/2000/svg'
          viewBox={iconInfo.viewBox}
          // --- The source root's paint attributes have to survive: dropping
          // --- fill="none" would turn every outline icon into a solid blob.
          fill={paint.fill}
          stroke={paint.stroke}
          strokeWidth={paint["stroke-width"]}
          strokeLinecap={paint["stroke-linecap"] as SVGProps<SVGSVGElement>["strokeLinecap"]}
          strokeLinejoin={paint["stroke-linejoin"] as SVGProps<SVGSVGElement>["strokeLinejoin"]}
          fillRule={paint["fill-rule"] as SVGProps<SVGSVGElement>["fillRule"]}
          clipRule={paint["clip-rule"]}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            // --- The theme colour reaches the markup through currentColor.
            // --- Setting `fill` here instead would override the root's
            // --- fill="none" and fill in every stroke icon.
            color: fillValue,
            fillOpacity: opacity,
            // --- fillOpacity alone does nothing for a stroked icon
            strokeOpacity: opacity,
            transform: `rotate(${rotate ?? 0}deg)`,
            flexShrink: 0,
            flexGrow: 0,
            ...style
          }}
          dangerouslySetInnerHTML={{ __html: iconInfo.content }}
        />
      );
    }

    return (
      <svg
        className={xclass}
        xmlns='http://www.w3.org/2000/svg'
        style={{ ...styleValue, ...style }}
        viewBox={"0 0 " + iconInfo.width + " " + iconInfo.height}
      >
        <path
          d={iconInfo.path}
          fillRule={iconInfo["fill-rule"] as SVGProps<SVGPathElement>["fillRule"]}
          clipRule={iconInfo["clip-rule"]}
        />
      </svg>
    );
  }
  return null;
});
